/**
 * GraphQL query to fetch PR timeline data
 */
export const PR_TIMELINE_QUERY = `
  query GetPRTimeline($owner: String!, $repo: String!, $prNumber: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $prNumber) {
        id
        number
        title
        state
        isDraft
        url
        createdAt
        updatedAt
        mergedAt
        mergeCommit {
          oid
        }
        mergedBy {
          login
        }
        baseRef {
          name
          target {
            oid
          }
          repository {
            owner {
              login
            }
            name
          }
        }
        headRef {
          target {
            oid
          }
        }
        author {
          login
        }
        labels(first: 100) {
          nodes {
            name
            color
          }
        }
        commits(first: 100) {
          nodes {
            commit {
              oid
              message
              committedDate
              committer {
                date
                name
                user {
                  login
                }
              }
              parents(first: 10) {
                nodes {
                  oid
                }
              }
            }
          }
        }
        reviews(first: 100) {
          nodes {
            id
            state
            submittedAt
            body
            url
            author {
              login
            }
          }
        }
        comments(first: 100) {
          nodes {
            id
            createdAt
            body
            url
            author {
              login
            }
          }
        }
        reviewThreads(first: 100) {
          nodes {
            id
            comments(first: 100) {
              nodes {
                id
                createdAt
                body
                url
                author {
                  login
                }
                replyTo {
                  id
                }
                isMinimized
              }
            }
          }
        }
        timelineItems(first: 100, itemTypes: [READY_FOR_REVIEW_EVENT, REVIEW_REQUESTED_EVENT, HEAD_REF_FORCE_PUSHED_EVENT, BASE_REF_CHANGED_EVENT]) {
          nodes {
            __typename
            ... on ReadyForReviewEvent {
              id
              createdAt
              actor {
                ... on User {
                  login
                }
                ... on Bot {
                  login
                }
              }
            }
            ... on ReviewRequestedEvent {
              id
              createdAt
              actor {
                ... on User {
                  login
                }
                ... on Bot {
                  login
                }
              }
              requestedReviewer {
                ... on User {
                  login
                }
                ... on Team {
                  name
                }
              }
            }
            ... on HeadRefForcePushedEvent {
              id
              createdAt
              actor {
                ... on User {
                  login
                }
                ... on Bot {
                  login
                }
              }
              beforeCommit {
                oid
              }
              afterCommit {
                oid
              }
              ref {
                name
              }
            }
            ... on BaseRefChangedEvent {
              id
              createdAt
              actor {
                ... on User {
                  login
                }
                ... on Bot {
                  login
                }
              }
              currentRefName
              previousRefName
            }
          }
        }
        additions
        deletions
        changedFiles
      }
    }
  }
`;
