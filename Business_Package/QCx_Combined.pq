let
    // ---- Edit these four names to match the queries in your Queries pane. ----
    // Keep the #"..." quotes; they are needed for names with spaces or special characters.
    ElectricalSource = #"Electrical_Inspection_Log",
    MechanicalSource = #"Mechanical_Process_Inspection_Log",
    WeldingSource = #"Welding_Inspections_Signoffs",
    BimSource = #"Issues",

    // ---- Electrical ----
    // The required columns: the refresh fails here if one of them is missing.
    ElectricalRequired = Table.SelectColumns(
        ElectricalSource,
        {"Work Week Observed", "Inspection Phase", "Issue?", "Building", "QCR/FE"},
        MissingField.Error
    ),
    // The filter and drill-down columns are optional: a source without one still loads,
    // with that column empty (null) on its rows.
    ElectricalSelected = Table.SelectColumns(
        ElectricalSource,
        Table.ColumnNames(ElectricalRequired)
            & {
                "General Contractor",
                "Trade Supplier",
                "Discipline",
                "Inspection Category",
                "Status",
                "Inspection ID",
                "Equipment ID / Tag Number",
                "Issue ID",
                "Finding Type",
                "Date Observed",
                "Notes"
            },
        MissingField.UseNull
    ),
    ElectricalRenamed = Table.RenameColumns(
        ElectricalSelected,
        {{"Work Week Observed", "Work Week"}, {"Issue?", "Issue"}}
    ),
    Electrical = Table.AddColumn(ElectricalRenamed, "Source", each "Electrical", type text),

    // ---- Mechanical (its people column is spelled "QCR / FE", with spaces) ----
    MechanicalRequired = Table.SelectColumns(
        MechanicalSource,
        {"Work Week Observed", "Inspection Phase", "Issue?", "Building", "QCR / FE"},
        MissingField.Error
    ),
    // The same optional columns as Electrical. Mechanical has no Inspection ID, so it's null on these rows.
    MechanicalSelected = Table.SelectColumns(
        MechanicalSource,
        Table.ColumnNames(MechanicalRequired)
            & {
                "General Contractor",
                "Trade Supplier",
                "Discipline",
                "Inspection Category",
                "Status",
                "Equipment ID / Tag Number",
                "Issue ID",
                "Finding Type",
                "Date Observed",
                "Notes"
            },
        MissingField.UseNull
    ),
    MechanicalRenamed = Table.RenameColumns(
        MechanicalSelected,
        {{"Work Week Observed", "Work Week"}, {"Issue?", "Issue"}, {"QCR / FE", "QCR/FE"}}
    ),
    Mechanical = Table.AddColumn(MechanicalRenamed, "Source", each "Mechanical", type text),

    // ---- Welding ----
    WeldingRequired = Table.SelectColumns(
        WeldingSource,
        {"WELD WORK WEEK", "ISSUE CREATED? (Put BIM # If Yes)", "WELDER", "TAG NO", "SIGNATURE", "WORK WEEK SIGNED"},
        MissingField.Error
    ),
    WeldingSelected = Table.SelectColumns(
        WeldingSource,
        Table.ColumnNames(WeldingRequired) & {"PIPE SPEC", "FLUID CODE", "WORK PKG"},
        MissingField.UseNull
    ),
    WeldingRenamed = Table.RenameColumns(
        WeldingSelected,
        {
            {"WELD WORK WEEK", "Work Week"},
            {"ISSUE CREATED? (Put BIM # If Yes)", "Issue"},
            {"WELDER", "Welder"},
            {"TAG NO", "Tag No"},
            {"SIGNATURE", "Signature"},
            {"WORK WEEK SIGNED", "Work Week Signed"},
            {"PIPE SPEC", "Pipe Spec"},
            {"FLUID CODE", "Fluid Code"},
            {"WORK PKG", "Work Package"}
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
    // Root cause, the four enrichment columns and the filter and drill-down columns are optional: a source
    // without one still loads, with that column empty (null) on its rows.
    BimSelected = Table.SelectColumns(
        BimSource,
        Table.ColumnNames(BimRequired)
            & {
                "Root cause",
                "BIM360_Created By",
                "BIM360_Created On",
                "BIM360_Closed On",
                "Closed at",
                "Title",
                "Contractor",
                "Due date",
                "Discipline",
                "Created By (Company)"
            },
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
            {"Closed at", "Closed At"},
            {"Due date", "Due Date"}
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
            {"Closed At", type date},
            {"General Contractor", type text},
            {"Contractor", type text},
            {"Trade Supplier", type text},
            {"Discipline", type text},
            {"Inspection Category", type text},
            {"Inspection ID", type text},
            {"Equipment ID / Tag Number", type text},
            {"Issue ID", type text},
            {"Finding Type", type text},
            {"Date Observed", type date},
            {"Notes", type text},
            {"Pipe Spec", type text},
            {"Fluid Code", type text},
            {"Work Package", type text},
            {"Title", type text},
            {"Due Date", type date},
            {"Created By (Company)", type text}
        }
    ),

    // These two only show in a drill-down list, so a stray non-date cell in them becomes a blank, not an error.
    Cleaned = Table.ReplaceErrorValues(Typed, {{"Date Observed", null}, {"Due Date", null}}),

    // ---- Row ID keeps identical rows apart, so Power BI never merges them. ----
    Indexed = Table.AddIndexColumn(Cleaned, "Row ID", 1, 1, Int64.Type),

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
            "Closed At",
            "General Contractor",
            "Contractor",
            "Trade Supplier",
            "Discipline",
            "Inspection Category",
            "Inspection ID",
            "Equipment ID / Tag Number",
            "Issue ID",
            "Finding Type",
            "Date Observed",
            "Notes",
            "Pipe Spec",
            "Fluid Code",
            "Work Package",
            "Title",
            "Due Date",
            "Created By (Company)"
        }
    )
in
    Result
