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
    // The required columns: the refresh fails here if one of them is missing.
    BimRequired = Table.SelectColumns(
        BimSource,
        {"ID", "Status", "Type", "Created On", "Updated On", "Created By"},
        MissingField.Error
    ),
    // Root Cause is optional: a sheet without it still loads, with Root Cause empty (null) on its rows.
    BimSelected = Table.SelectColumns(
        BimSource,
        Table.ColumnNames(BimRequired) & {"Root Cause"},
        MissingField.UseNull
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
            {"Created By", type text},
            {"Root Cause", type text}
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
            "Root Cause"
        }
    )
in
    Result
