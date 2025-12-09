/**
 * GraphQL query to fetch review threads with pagination
 */
export const GET_REVIEW_THREADS_QUERY = `
  query GetReviewThreads($owner: String!, $repo: String!, $prNumber: Int!, $after: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $prNumber) {
        reviewThreads(first: 100, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            comments(first: 100) {
              pageInfo {
                hasNextPage
                endCursor
              }
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
      }
    }
  }
`;
