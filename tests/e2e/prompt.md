You are an automated E2E test runner for the Codle MCP server.
Execute the following 12 steps IN ORDER. For each step, report the result in this exact format:

```
[STEP N] tool_name — pass/fail (brief reason if fail)
```

After all steps, output a summary table.

IMPORTANT:
- Execute steps sequentially. Each step depends on previous results.
- Use ONLY MCP tools (mcp__codle__*). Do not use any other tools.
- If a step fails, still continue with remaining steps where possible.
- Report ALL results at the end.

---

## Step 1: List tags by domain
Call `manage_tags` with domain "material".
Expected: Returns a list of tags. Verify the response contains tag items.

## Step 2: Search tags by keyword
Call `manage_tags` with query "파이썬".
Expected: Returns tags matching the keyword.

## Step 3: Search public materials
Call `search_materials` with is_public=true, page_size=5.
Expected: Returns a list of public materials. Save the first material's ID for Step 5.

## Step 4: Search my materials
Call `search_materials` with is_public=false, page_size=5.
Expected: Returns a list of materials (may be empty if no materials exist).

## Step 5: Get material detail
Call `get_material_detail` with the material_id from Step 3.
Expected: Returns material details including activities and tags.

## Step 6: Create test material
Call `manage_materials` with action="create", name="E2E Test __TIMESTAMP__".
Expected: Returns the created material with an ID. Save this ID for subsequent steps.

## Step 7: Create first activity
Call `manage_activities` with action="create", material_id=(from Step 6), name="E2E Activity 1", activity_type="HtmlActivity".
Expected: Returns the created activity with an ID. Save it.

## Step 8: Create second activity
Call `manage_activities` with action="create", material_id=(from Step 6), name="E2E Activity 2", activity_type="HtmlActivity".
Expected: Returns the created activity with an ID. Save it.

## Step 9: Set activity flow
Call `set_activity_flow` with material_id=(from Step 6), activity_ids=[(Step 7 ID), (Step 8 ID)].
Expected: Flow is set successfully connecting the two activities linearly.

## Step 10: Verify flow
Call `get_material_detail` with material_id=(from Step 6).
Expected: Material detail shows the two activities connected in a linear flow (transitions present).

## Step 11: Delete activities
Call `manage_activities` with action="delete", activity_id=(Step 7 ID).
Then call `manage_activities` with action="delete", activity_id=(Step 8 ID).
Expected: Both activities are deleted successfully.

## Step 12: Verify cleanup
Call `get_material_detail` with material_id=(from Step 6).
Expected: Material detail shows no activities remaining.

---

## Summary

After completing all steps, output the following summary table:

```
## E2E Test Results

| Step | Tool | Result | Notes |
|------|------|--------|-------|
| 1 | manage_tags | pass/fail | ... |
| 2 | manage_tags | pass/fail | ... |
| ... | ... | ... | ... |

Total: X/12 passed
Timestamp: <current timestamp>
```
