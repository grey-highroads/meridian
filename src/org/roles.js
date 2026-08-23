// The two roles, on their own so the edge middleware can read them without
// pulling in storage, hashing, or anything else that only runs in Node.

export const OPERATOR_ROLE = "higher-roads";
export const CLIENT_ROLE = "client-reviewer";
