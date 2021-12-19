#!/usr/bin/env node

import { readFile } from 'fs/promises'
import { getOctokit } from '@actions/github'

/**
 * Creates a new pull request labeled with the `translation-batch{-*}` labels.
 * @param {number} retryCount - The number of times to retry the operation.
 * @returns undefined
 */
async function createTranslationBatchPullRequest(retryCount) {
  const {
    // These are the values that are passed in from the step in the workflow file.
    GITHUB_TOKEN,
    TITLE,
    BASE,
    HEAD,
    LANGUAGE,
    BODY_FILE,
    // https://docs.github.com/en/actions/learn-github-actions/environment-variables#default-environment-variables
    GITHUB_REPOSITORY,
  } = process.env

  // Throw an error if the required environment variables are not set.
  if (!GITHUB_TOKEN) {
    throw new Error('You must supply a GITHUB_TOKEN environment variable!')
  }
  if (!TITLE) {
    throw new Error('You must supply a TITLE environment variable!')
  }
  if (!BASE) {
    throw new Error('You must supply a BASE environment variable!')
  }
  if (!HEAD) {
    throw new Error('You must supply a HEAD environment variable!')
  }
  if (!LANGUAGE) {
    throw new Error('You must supply a LANGUAGE environment variable!')
  }
  if (!BODY_FILE) {
    throw new Error('You must supply a BODY_FILE environment variable!')
  }
  if (!GITHUB_REPOSITORY) {
    throw new Error('GITHUB_REPOSITORY environment variable not set')
  }

  try {
    // Create a new pull request with the specified parameters.
    const github = getOctokit(GITHUB_TOKEN)
    const [org, repo] = GITHUB_REPOSITORY.split('/')
    const body = await readFile(BODY_FILE, 'utf8')
    const { data: pullRequest } = await github.rest.pulls.create({
      owner: org,
      repo: repo,
      base: BASE,
      head: HEAD,
      title: TITLE,
      body: body,
      draft: false,
    })

    console.log(`Created pull request: ${pullRequest.url}`)

    // metadata parameters aren't currently available in `github.rest.pulls.create`,
    // but they are in `github.rest.issues.update`.
    const labels = ['translation-batch', `translation-batch-${LANGUAGE}`]
    const { data: updatedPullRequest } = await github.rest.issues.update({
      owner: org,
      repo: repo,
      issue_number: pullRequest.number,
      labels: labels,
    })

    console.log(
      `Updated ${GITHUB_REPOSITORY}#${pullRequest.number} with these labels: ${updatedPullRequest.labels}`
    )
  } catch (error) {
    // Retry the operation if the API responds with a `502 Bad Gateway` error.
    if (retryCount > 0 && error.status === 502) {
      console.error(`Error creating pull request: ${error.message}`)
      console.error(`Retrying in 5 seconds...`)
      await new Promise((resolve) => setTimeout(resolve, 5000))
      return createTranslationBatchPullRequest(retryCount - 1)
    }

    console.error(`Failed to create pull request: ${error.message}`)
    console.error(error)
    throw error
  }
}

async function main() {
  await createTranslationBatchPullRequest(3)
}

main()
