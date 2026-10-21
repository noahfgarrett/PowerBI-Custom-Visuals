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
