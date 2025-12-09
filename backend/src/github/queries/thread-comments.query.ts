/**
 * GraphQL query to fetch thread comments with pagination
 */
export const GET_THREAD_COMMENTS_QUERY = `
  query GetThreadComments($owner: String!, $repo: String!, $prNumber: Int!, $threadId: ID!, $after: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $prNumber) {
        reviewThread(id: $threadId) {
          comments(first: 100, after: $after) {
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
`;
