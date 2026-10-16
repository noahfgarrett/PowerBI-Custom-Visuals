# QAQC Combined table: setup

The QAQC Overview and QAQC Performance visuals read one table, **QAQC Combined**. This guide adds it to your report.

## Why the table is needed

A custom visual sees only one table. The Electrical, Mechanical, Welding and BIM Issues sheets are four separate tables with no relationship between them, so a visual can't read all four at once.

QAQC Combined appends the four into one table with fixed column names. Each row keeps a **Source** column that says which sheet it came from. Your four existing queries stay as they are, and the Electrical, Mechanical, Welding and BIM Issues visuals keep using them.

## 1. Add the query (once per report)

1. In Power BI Desktop, select **Home → Transform data** to open Power Query.
2. In the Queries pane on the left, note the exact names of your four sheet queries: Electrical inspections, Mechanical / Process inspections, Welding inspections / signoffs, and the BIM Issues log.
3. Select **Home → New Source → Blank Query**. A new query called `Query1` appears.
4. With `Query1` selected, select **Home → Advanced Editor**.
5. Delete everything in the editor, paste the script below, and select **Done**.
6. Rename the query to **QAQC Combined**: right-click `Query1` in the Queries pane, select **Rename**, and type `QAQC Combined`. You can also change **Name** under Query Settings → Properties on the right.
7. Check the preview. It should show 17 columns, starting with Source and Row ID, and rows from all four sheets.
8. Select **Home → Close & Apply**.

The script is also saved next to this guide as `QAQC_Combined.pq`, so you can open it in a text editor and copy it from there.

### Edit only the four names at the top

The first four lines name your existing queries:

| Line | Default query name |
|---|---|
| `ElectricalSource` | `#"Electrical_Inspection_Log"` |
| `MechanicalSource` | `#"Mechanical_Process_Inspection_Log"` |
| `WeldingSource` | `#"Welding_Inspections_Signoffs"` |
| `BimSource` | `#"BIM Issues Log"` |

If a query in your Queries pane has a different name, change the text inside the quotes to match it exactly. Keep the `#"…"` around the name; Power Query needs it for names with spaces or special characters. Leave the rest of the script as it is.

## 2. The script

```powerquery
let
    // ---- Edit these four names to match the queries in your Queries pane. ----
    // Keep the #"..." quotes; they are needed for names with spaces or special characters.
    ElectricalSource = #"Electrical_Inspection_Log",
    MechanicalSource = #"Mechanical_Process_Inspection_Log",
    WeldingSource = #"Welding_Inspections_Signoffs",
    BimSource = #"BIM Issues Log",

    // ---- Electrical ----
    ElectricalSelected = Table.SelectColumns(
        ElectricalSource,
        {"Work Week Observed", "Inspection Phase", "Issue?", "Building", "QCR/FE"},
        MissingField.Error
    ),
    ElectricalRenamed = Table.RenameColumns(
        ElectricalSelected,
        {{"Work Week Observed", "Work Week"}, {"Issue?", "Issue"}}
    ),
    Electrical = Table.AddColumn(ElectricalRenamed, "Source", each "Electrical", type text),

    // ---- Mechanical (its people column is spelled "QCR / FE", with spaces) ----
    MechanicalSelected = Table.SelectColumns(
        MechanicalSource,
        {"Work Week Observed", "Inspection Phase", "Issue?", "Building", "QCR / FE"},
        MissingField.Error
    ),
    MechanicalRenamed = Table.RenameColumns(
        MechanicalSelected,
        {{"Work Week Observed", "Work Week"}, {"Issue?", "Issue"}, {"QCR / FE", "QCR/FE"}}
    ),
    Mechanical = Table.AddColumn(MechanicalRenamed, "Source", each "Mechanical", type text),

    // ---- Welding ----
    WeldingSelected = Table.SelectColumns(
        WeldingSource,
        {"WELD WORK WEEK", "ISSUE CREATED? (Put BIM # If Yes)", "WELDER", "TAG NO", "SIGNATURE", "WORK WEEK SIGNED"},
        MissingField.Error
    ),
    WeldingRenamed = Table.RenameColumns(
        WeldingSelected,
        {
            {"WELD WORK WEEK", "Work Week"},
            {"ISSUE CREATED? (Put BIM # If Yes)", "Issue"},
            {"WELDER", "Welder"},
            {"TAG NO", "Tag No"},
            {"SIGNATURE", "Signature"},
            {"WORK WEEK SIGNED", "Work Week Signed"}
        }
    ),
    Welding = Table.AddColumn(WeldingRenamed, "Source", each "Welding", type text),

    // ---- BIM Issues ----
    BimSelected = Table.SelectColumns(
        BimSource,
        {"ID", "Status", "Type", "Created On", "Updated On", "Created By"},
        MissingField.Error
    ),
    // The BIM column names already match the combined table, so there is nothing to rename.
    Bim = Table.AddColumn(BimSelected, "Source", each "BIM", type text),

    // ---- Append the four. Columns a source doesn't have are null on its rows. ----
    Combined = Table.Combine({Electrical, Mechanical, Welding, Bim}),

    Typed = Table.TransformColumnTypes(
        Combined,
        {
            {"Source", type text},
            {"Work Week", type text},
            {"Inspection Phase", type text},
            {"Issue", type text},
            {"Building", type text},
            {"QCR/FE", type text},
            {"Welder", type text},
            {"Tag No", type text},
            {"Signature", type text},
            {"Work Week Signed", type text},
            {"ID", type text},
            {"Status", type text},
            {"Type", type text},
            {"Created On", type date},
            {"Updated On", type date},
            {"Created By", type text}
        }
    ),

    // ---- Row ID keeps identical rows apart, so Power BI never merges them. ----
    Indexed = Table.AddIndexColumn(Typed, "Row ID", 1, 1, Int64.Type),

    Result = Table.SelectColumns(
        Indexed,
        {
            "Source",
            "Row ID",
            "Work Week",
            "Inspection Phase",
            "Issue",
            "Building",
            "QCR/FE",
            "Welder",
            "Tag No",
            "Signature",
            "Work Week Signed",
            "ID",
            "Status",
            "Type",
            "Created On",
            "Updated On",
            "Created By"
        }
    )
in
    Result
```

What it does:

1. **Selects** the columns the visuals need from each source. `MissingField.Error` makes the refresh fail if one of those columns is missing (see Troubleshooting), so a renamed Smartsheet column can never turn into silent zeros.
2. **Renames** them to the combined names (for example `Work Week Observed` → `Work Week`) and adds **Source**: `Electrical`, `Mechanical`, `Welding` or `BIM`.
3. **Appends** the four tables. A column a source doesn't have is empty (null) on that source's rows.
4. **Sets types:** text for every text column, including both Work Week columns, and date for Created On and Updated On. If a Work Week column comes through as a number (for example `42.2026`), it becomes the text `42.2026`, which the visuals read as WW42'2026, the same as `WW42'2026` typed as text. One catch: a number drops trailing zeros, so `42.2030` would arrive as `42.203`. Keep the Smartsheet column as text if you can.
5. **Adds Row ID**, numbered from 1 after the append. Power BI merges rows that are identical in every bound column; Row ID keeps every row separate. You don't need a separate index column in any of the four sheet queries for this table.
6. **Orders** the columns as listed below.

## 3. Column reference

| Column | Electrical | Mechanical | Welding | BIM |
|---|---|---|---|---|
| Source | `Electrical` | `Mechanical` | `Welding` | `BIM` |
| Row ID | added by the script | added by the script | added by the script | added by the script |
| Work Week | Work Week Observed | Work Week Observed | WELD WORK WEEK | — |
| Inspection Phase | Inspection Phase | Inspection Phase | — | — |
| Issue | Issue? | Issue? | ISSUE CREATED? (Put BIM # If Yes) | — |
| Building | Building | Building | — | — |
| QCR/FE | QCR/FE | QCR / FE | — | — |
| Welder | — | — | WELDER | — |
| Tag No | — | — | TAG NO | — |
| Signature | — | — | SIGNATURE | — |
| Work Week Signed | — | — | WORK WEEK SIGNED | — |
| ID | — | — | — | ID |
| Status | — | — | — | Status |
| Type | — | — | — | Type |
| Created On | — | — | — | Created On |
| Updated On | — | — | — | Updated On |
| Created By | — | — | — | Created By |

Row ID is one sequence, 1, 2, 3 …, through every row of the combined table. A dash (—) means the column is empty on that source's rows. Note the Mechanical header spelling `QCR / FE`, with spaces, which differs from Electrical's `QCR/FE`.

The QAQC Overview binds 14 of these columns and the QAQC Performance visual binds 9. See `QAQC_Overview_SETUP.md` and `QAQC_Performance_SETUP.md`.

## Troubleshooting

**"Expression.Error: The column '…' of the table wasn't found."**
A Smartsheet column was renamed, or the sheet query renames it. The message names the missing column. Open the sheet's own query to find the column's new name, then change the old name in the script: in that source's `Table.SelectColumns` list, and on the left of its `Table.RenameColumns` pair if it has one. For example, if `Work Week Observed` became `Work Week` in the Electrical sheet, change both `"Work Week Observed"` entries in the Electrical section. Don't change the names on the right of a rename pair; the visuals expect those.

**An error that names one of your four queries.**
A name at the top of the script doesn't match a query in the Queries pane. Copy the name exactly, including spaces and capital letters.

**"DataFormat.Error" on the type step.**
A value can't be converted, usually a Created On or Updated On cell that isn't a date. Fix the cell in Smartsheet, or check the BIM query's own type for that column.

**The visuals' footnote says "n rows with an unknown Source".**
The visuals read Source ignoring case and extra spaces, and only `Electrical`, `Mechanical`, `Welding` and `BIM` are counted. Rows with any other Source value are skipped, and the footnote gives how many. With the script unchanged this can't happen, so check whether the text in one of the `"Source", each "…"` lines was edited, or whether another step or table was appended to QAQC Combined.
