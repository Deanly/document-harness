import {
  ALLOWED_STATUSES,
  applyPlan,
  commandError,
  createPlan,
  rollbackReceipt,
  verifyTarget,
} from "./harness-adopt.mjs";

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) throw new Error(`unexpected argument: ${token}`);
    const key = token.slice(2);
    const value = rest[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value for ${token}`);
    options[key] = value;
    index += 1;
  }
  return { command, options };
}

function required(options, key) {
  if (!options[key]) throw new Error(`missing required option --${key}`);
  return options[key];
}

function usage() {
  return [
    "Usage:",
    "  harness-adopt plan --target <repository> --profile core,governance,view --output <plan.json>",
    "  harness-adopt apply --plan <plan.json> --expect-plan-hash <sha256>",
    "  harness-adopt verify --target <repository>",
    "  harness-adopt rollback --receipt <apply-receipt.json>",
  ].join("\n");
}

let command = "unknown";
try {
  const parsed = parseArgs(process.argv.slice(2));
  command = parsed.command;
  let result;
  if (command === "plan") {
    result = createPlan({
      target: required(parsed.options, "target"),
      profiles: required(parsed.options, "profile").split(",").map((value) => value.trim()).filter(Boolean),
      output: required(parsed.options, "output"),
    });
  } else if (command === "apply") {
    result = applyPlan({
      planFile: required(parsed.options, "plan"),
      expectedPlanHash: required(parsed.options, "expect-plan-hash"),
    });
  } else if (command === "verify") {
    result = verifyTarget({ target: required(parsed.options, "target") });
  } else if (command === "rollback") {
    result = rollbackReceipt({ receiptFile: required(parsed.options, "receipt") });
  } else if (command === "help" || command === "--help" || !command) {
    process.stdout.write(`${usage()}\n`);
    process.exit(0);
  } else {
    throw new Error(`unknown command: ${command}\n${usage()}`);
  }
  if (!ALLOWED_STATUSES.includes(result.status)) throw new Error(`engine returned invalid status: ${result.status}`);
  process.stdout.write(JSON.stringify(result));
  process.stdout.write("\n");
  const incompleteVerification = command === "verify" && result.status !== "MIGRATION_VERIFIED";
  process.exitCode = incompleteVerification || ["NEEDS_DECISION", "APPLY_FAILED"].includes(result.status) ? 2 : 0;
} catch (error) {
  const result = commandError(command, error);
  process.stdout.write(JSON.stringify(result));
  process.stdout.write("\n");
  process.exitCode = 2;
}
