# QCx Combined table: setup

The QCx Overview and QCx Performance visuals read one table, **QCx Combined**. This guide adds it to your report.

## Why the table is needed

A custom visual sees only one table. The Electrical, Mechanical and Welding sheets and the BIM issues are four separate tables with no relationship between them, so a visual can't read all four at once.

QCx Combined appends the four into one table with fixed column names. Each row keeps a **Source** column that says which table it came from. Your four existing queries stay as they are, and the Electrical, Mechanical, Welding and Issues visuals keep using them.

The BIM issues come from the **enriched Autodesk export**, for example `Automated Issue Summary-…-Enriched-….xlsx`, sheet **Issues**. They no longer come from the Smartsheet BIM Issues Log. The export's BIM360 columns hold the real creator and dates of the issues migrated from BIM 360, so those issues count in the weeks they were really opened and closed.

## 1. Add the query (once per report)

1. In Power BI Desktop, select **Home → Transform data** to open Power Query.
2. In the Queries pane on the left, note the exact names of your four source queries: Electrical inspections, Mechanical / Process inspections, Welding inspections / signoffs, and the enriched Autodesk issues export.
3. Select **Home → New Source → Blank Query**. A new query called `Query1` appears.
4. With `Query1` selected, select **Home → Advanced Editor**.
5. Delete everything in the editor, paste the script below, and select **Done**.
6. Rename the query to **QCx Combined**: right-click `Query1` in the Queries pane, select **Rename**, and type `QCx Combined`. You can also change **Name** under Query Settings → Properties on the right.
7. Check the preview. It should show 22 columns, starting with Source and Row ID, and rows from all four sources.
8. Select **Home → Close & Apply**.

The script is also saved next to this guide as `QCx_Combined.pq`, so you can open it in a text editor and copy it from there.

### Edit only the four names at the top

The first four lines name your existing queries:

| Line | Default query name |
|---|---|
| `ElectricalSource` | `#"Electrical_Inspection_Log"` |
| `MechanicalSource` | `#"Mechanical_Process_Inspection_Log"` |
| `WeldingSource` | `#"Welding_Inspections_Signoffs"` |
| `BimSource` | `#"Issues"`, the enriched export's sheet name |

If a query in your Queries pane has a different name, change the text inside the quotes to match it exactly. Keep the `#"…"` around the name; Power Query needs it for names with spaces or special characters. Leave the rest of the script as it is.

`BimSource` must name your **enriched** issues query, the one that loads the enriched Autodesk export. If you named that query something other than `Issues`, rename `#"Issues"` in the script to match it.

## 2. The script

```powerquery
let
    // ---- Edit these four names to match the queries in your Queries pane. ----
    // Keep the #"..." quotes; they are needed for names with spaces or special characters.
    ElectricalSource = #"Electrical_Inspection_Log",
    MechanicalSource = #"Mechanical_Process_Inspection_Log",
    WeldingSource = #"Welding_Inspections_Signoffs",
    BimSource = #"Issues",

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

    // ---- BIM Issues (the enriched Autodesk export) ----
    // Names are spelled exactly as the export spells them; Power Query matches column names case-sensitively.
    // The required columns: the refresh fails here if one of them is missing.
    BimRequired = Table.SelectColumns(
        BimSource,
        {"ID", "Status", "Type", "Created on", "Updated on", "Created by"},
        MissingField.Error
    ),
    // Root cause and the four enrichment columns are optional: a source without one still loads,
    // with that column empty (null) on its rows.
    BimSelected = Table.SelectColumns(
        BimSource,
        Table.ColumnNames(BimRequired)
            & {"Root cause", "BIM360_Created By", "BIM360_Created On", "BIM360_Closed On", "Closed at"},
        MissingField.UseNull
    ),
    BimRenamed = Table.RenameColumns(
        BimSelected,
        {
            {"Created on", "Created On"},
            {"Updated on", "Updated On"},
            {"Created by", "Created By"},
            {"Root cause", "Root Cause"},
            {"BIM360_Created By", "BIM360 Created By"},
            {"BIM360_Created On", "BIM360 Created On"},
            {"BIM360_Closed On", "BIM360 Closed On"},
            {"Closed at", "Closed At"}
        }
    ),
    Bim = Table.AddColumn(BimRenamed, "Source", each "BIM", type text),

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
            {"Created By", type text},
            {"Root Cause", type text},
            // The BIM360 dates stay text, such as 10/15/22 3:45 PM; the visuals read the date part.
            {"BIM360 Created By", type text},
            {"BIM360 Created On", type text},
            {"BIM360 Closed On", type text},
            {"Closed At", type date}
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
            "Created By",
            "Root Cause",
            "BIM360 Created By",
            "BIM360 Created On",
            "BIM360 Closed On",
            "Closed At"
        }
    )
in
    Result
```

What it does:

1. **Selects** the columns the visuals need from each source. `MissingField.Error` makes the refresh fail if one of those columns is missing (see Troubleshooting), so a renamed column can never turn into silent zeros. On the BIM side, ID, Status, Type, Created on, Updated on and Created by are required. Root cause and the four enrichment columns are optional: `BIM360_Created By`, `BIM360_Created On`, `BIM360_Closed On` and `Closed at`. They are selected with `MissingField.UseNull`, so an export without one still loads, and that column is empty on its rows.
2. **Renames** them to the combined names (for example `Work Week Observed` → `Work Week`, `Created on` → `Created On`, `BIM360_Created By` → `BIM360 Created By`) and adds **Source**: `Electrical`, `Mechanical`, `Welding` or `BIM`. Power Query matches column names case-sensitively, so the script spells the export's columns exactly as the export does, for example `Created on` with a lower-case "o".
3. **Appends** the four tables. A column a source doesn't have is empty (null) on that source's rows.
4. **Sets types:** text for every text column, including both Work Week columns and the BIM360 dates, and date for Created On, Updated On and Closed At. The BIM360 dates stay text, such as `10/15/22 3:45 PM`, and the visuals read the date part. If a Work Week column comes through as a number (for example `42.2026`), it becomes the text `42.2026`, which the visuals read as WW42'2026, the same as `WW42'2026` typed as text. One catch: a number drops trailing zeros, so `42.2030` would arrive as `42.203`. Keep the Smartsheet column as text if you can.
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
| Created On | — | — | — | Created on |
| Updated On | — | — | — | Updated on |
| Created By | — | — | — | Created by |
| Root Cause | — | — | — | Root cause (optional) |
| BIM360 Created By | — | — | — | BIM360_Created By (optional) |
| BIM360 Created On | — | — | — | BIM360_Created On (optional) |
| BIM360 Closed On | — | — | — | BIM360_Closed On (optional) |
| Closed At | — | — | — | Closed at (optional) |

Row ID is one sequence, 1, 2, 3 …, through every row of the combined table. A dash (—) means the column is empty on that source's rows. Note the Mechanical header spelling `QCR / FE`, with spaces, which differs from Electrical's `QCR/FE`.

The QCx Overview binds 14 of these columns, plus Root Cause and the four BIM360 and Closed At columns in its optional slots, and the QCx Performance visual binds 9. See `QCx_Overview_SETUP.md` and `QCx_Performance_SETUP.md`.

## Troubleshooting

**"Expression.Error: The column '…' of the table wasn't found."**
A source column was renamed, or the source query renames it. The message names the missing column. Column names must match exactly, including capital letters: the enriched export spells `Created on`, `Updated on` and `Created by` with lower-case second words. Open the sheet's own query to find the column's new name, then change the old name in the script: in that source's `Table.SelectColumns` list, and on the left of its `Table.RenameColumns` pair if it has one. For example, if `Work Week Observed` became `Work Week` in the Electrical sheet, change both `"Work Week Observed"` entries in the Electrical section. Don't change the names on the right of a rename pair; the visuals expect those.

**An error that names one of your four queries.**
A name at the top of the script doesn't match a query in the Queries pane. Copy the name exactly, including spaces and capital letters.

**"DataFormat.Error" on the type step.**
A value can't be converted, usually a Created On, Updated On or Closed At cell that isn't a date. Fix the cell in the source, or check the source query's own type for that column.

**The visuals' footnote says "n rows with an unknown Source".**
The visuals read Source ignoring case and extra spaces, and only `Electrical`, `Mechanical`, `Welding` and `BIM` are counted. Rows with any other Source value are skipped, and the footnote gives how many. With the script unchanged this can't happen, so check whether the text in one of the `"Source", each "…"` lines was edited, or whether another step or table was appended to QCx Combined.
