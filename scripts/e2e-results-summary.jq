[.testResults[].assertionResults[]] as $t
| ($t | map(select(.status == "passed"))) as $passed
| ($t | map(select(.status == "failed"))) as $failed
| ($t | map(select(.status == "pending" or .status == "skipped"))) as $skipped
| ($passed | map(select(.invocations > 1))) as $retried
| ([.testResults[] | select(.status == "failed" and ((.assertionResults | length) == 0))]) as $suites
| "### \($title)\n\n| Passed | Failed | Skipped | Passed after retry | Suites that did not run |\n|---|---|---|---|---|\n| \($passed | length) | \($failed | length) | \($skipped | length) | \($retried | length) | \($suites | length) |\n"
  + (if ($suites | length) > 0 then "\n**Suites that did not run**\n" + ($suites | map("- " + (.name | split("/") | last)) | join("\n")) + "\n" else "" end)
  + (if ($failed | length) > 0 then "\n**Failed**\n" + ($failed | map("- " + .fullName) | join("\n")) + "\n" else "" end)
  + (if ($retried | length) > 0 then "\n**Passed after retry**\n" + ($retried | map("- " + .fullName) | join("\n")) + "\n" else "" end)
  + (if ($skipped | length) > 0 then "\n**Skipped**\n" + ($skipped | map("- " + .fullName) | join("\n")) + "\n" else "" end)
