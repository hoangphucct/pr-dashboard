/**
 * GraphQL query to fetch PRs by date range
 */
export const PRS_BY_DATE_QUERY = `
  query GetPRsByDate($owner: String!, $repo: String!, $after: String) {
    repository(owner: $owner, name: $repo) {
      pullRequests(first: 100, states: [OPEN, CLOSED, MERGED], orderBy: {field: CREATED_AT, direction: DESC}, after: $after) {
        nodes {
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
            target {
              oid
            }
            repository {
              owner {
                login
              }
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
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;
