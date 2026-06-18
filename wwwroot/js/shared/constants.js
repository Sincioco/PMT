export const fallbackStatuses = [
  "Backlog",
  "Todo",
  "In Progress",
  "Code Complete",
  "Ready for QA",
  "QA in Progress",
  "QA Failed",
  "QA Passed",
  "Deployed in SIT",
  "Deployed in UAT",
  "Deployed in Prod"
];

export const fallbackPriorities = ["Lowest", "Low", "Medium", "High", "Highest"];
export const fallbackSeverities = ["Trivial", "Minor", "Major", "Critical"];
export const fallbackEnvironments = ["local", "Dev", "SIT", "UAT", "Production"];

export const linkedBugCompletionMessage = "You cannot mark this task as complete until the associated bug is marked as QA Passed.  Once QA has re-tested the bug and passed it, the completion of your Dev Task will be set to 100%.";

export function fallbackForLookup(type) {
  if (type === "Status") return fallbackStatuses;
  if (type === "Priority") return fallbackPriorities;
  if (type === "Severity") return fallbackSeverities;
  if (type === "Environment") return fallbackEnvironments;
  return [];
}
