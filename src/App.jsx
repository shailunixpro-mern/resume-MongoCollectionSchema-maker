import { useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://resume-backend-fnjs.onrender.com";

const DEFAULT_FIELD = { name: "", bsonType: "string", required: true };
const DEFAULT_EDIT_FIELD = {
  originalName: "",
  name: "",
  bsonType: "string",
  required: false,
  deleted: false,
  isNew: true,
};

const prettify = (value) => JSON.stringify(value, null, 2);

const formatTime = (iso) => {
  if (!iso) {
    return "Not available";
  }

  return new Date(iso).toLocaleString();
};

const getBackendStatusTone = (backendStatus) => {
  if (backendStatus === "ok") {
    return "green";
  }

  return "red";
};

const getMongoStatusTone = (connectionState) => {
  if (connectionState === "connected") {
    return "green";
  }

  if (connectionState === "connecting") {
    return "yellow";
  }

  return "red";
};

const isRecentWithinMinutes = (iso, minutes) => {
  if (!iso) {
    return false;
  }

  const parsed = new Date(iso).getTime();
  if (Number.isNaN(parsed)) {
    return false;
  }

  const elapsedMs = Date.now() - parsed;
  return elapsedMs <= minutes * 60 * 1000;
};

const normalizeBsonType = (definition) => {
  if (!definition || typeof definition !== "object") {
    return "string";
  }

  if (Array.isArray(definition.bsonType)) {
    return definition.bsonType.find((type) => type !== "null") || definition.bsonType[0] || "string";
  }

  return definition.bsonType || "string";
};

const buildEditableRows = (schemaData) => {
  const schema = schemaData?.validatorSchema || schemaData?.sampledSchema;
  const requiredSet = new Set(Array.isArray(schemaData?.validatorSchema?.required) ? schemaData.validatorSchema.required : []);
  const properties = schema?.properties || {};

  return Object.entries(properties)
    .filter(([fieldName]) => fieldName !== "_id")
    .map(([fieldName, definition]) => ({
      originalName: fieldName,
      name: fieldName,
      bsonType: normalizeBsonType(definition),
      required: requiredSet.has(fieldName),
      deleted: false,
      isNew: false,
    }));
};

function SchemaFieldRow({
  row,
  index,
  supportedTypes,
  mode,
  onChange,
  onAddRow,
  onToggleDelete,
}) {
  const isDisabled = mode === "edit" && row.deleted;

  return (
    <div className={`schema-row ${row.deleted ? "schema-row-deleted" : ""}`}>
      <div className="field-copy">
        <span className="field-label">Field name</span>
        <input
          type="text"
          placeholder="Field name"
          value={row.name}
          disabled={isDisabled}
          onChange={(event) => onChange(index, "name", event.target.value)}
        />
      </div>

      <div className="field-copy">
        <span className="field-label">Type</span>
        <select
          value={row.bsonType}
          disabled={isDisabled}
          onChange={(event) => onChange(index, "bsonType", event.target.value)}
        >
          {supportedTypes.map((type) => (
            <option value={type} key={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <label className="required-box field-copy">
        <span className="field-label">Required</span>
        <input
          type="checkbox"
          checked={row.required}
          disabled={isDisabled}
          onChange={(event) => onChange(index, "required", event.target.checked)}
        />
        Required
      </label>

      <button type="button" className="icon-btn" onClick={onAddRow}>
        +
      </button>

      {mode === "edit" && (
        <button type="button" className="secondary" onClick={() => onToggleDelete(index)}>
          {row.deleted ? "Restore" : row.isNew ? "Remove" : "Delete"}
        </button>
      )}

      {mode === "edit" && row.originalName && (
        <div className="field-meta">Original: {row.originalName}</div>
      )}

      {mode === "edit" && row.isNew && <div className="field-meta">New field</div>}
    </div>
  );
}

async function apiCall(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body?.message || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return body;
}

export default function App() {
  const [collectionsOutput, setCollectionsOutput] = useState("No data loaded yet.");
  const [describeName, setDescribeName] = useState("");
  const [describeOutput, setDescribeOutput] = useState("No description loaded yet.");
  const [backendHealth, setBackendHealth] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [lastDataFetchAt, setLastDataFetchAt] = useState("");

  const [createName, setCreateName] = useState("");
  const [rows, setRows] = useState([{ ...DEFAULT_FIELD }]);
  const [showSchemaBuilder, setShowSchemaBuilder] = useState(false);

  const [editName, setEditName] = useState("");
  const [editRows, setEditRows] = useState([{ ...DEFAULT_EDIT_FIELD }]);
  const [showEditBuilder, setShowEditBuilder] = useState(false);

  const [statusText, setStatusText] = useState("Status messages and command output will appear here.");
  const [isBusy, setIsBusy] = useState(false);
  const fetchTimeStorageKey = "lastSuccessfulPortfolioFetchAt";

  const supportedTypes = useMemo(
    () => [
      "double",
      "string",
      "object",
      "array",
      "binData",
      "objectId",
      "bool",
      "date",
      "null",
      "regex",
      "int",
      "timestamp",
      "long",
      "decimal",
    ],
    []
  );

  const loadPortfolio = async () => {
    try {
      await apiCall("/api/portfolio");
      const fetchTime = new Date().toISOString();
      setLastDataFetchAt(fetchTime);
      window.localStorage.setItem(fetchTimeStorageKey, fetchTime);
    } catch {
      // Keep the last successful fetch time intact when the API is unavailable.
    }
  };

  const loadConnectionStatus = async () => {
    const [healthResult, statusResult] = await Promise.allSettled([
      apiCall("/api/health"),
      apiCall("/api/system/status"),
    ]);

    if (healthResult.status === "fulfilled") {
      setBackendHealth(healthResult.value || null);
    } else {
      setBackendHealth(null);
    }

    if (statusResult.status === "fulfilled") {
      setSystemStatus(statusResult.value || null);
    } else {
      setSystemStatus(null);
    }
  };

  useEffect(() => {
    const storedFetchTime = window.localStorage.getItem(fetchTimeStorageKey);
    if (storedFetchTime) {
      setLastDataFetchAt(storedFetchTime);
    }

    loadPortfolio();
    loadConnectionStatus();
  }, []);

  const backendFresh = isRecentWithinMinutes(lastDataFetchAt, 60);
  const mongoFresh = isRecentWithinMinutes(systemStatus?.database?.lastConnectedAt, 60);
  const mongoUriToShow =
    systemStatus?.database?.mongoUri ||
    "Unavailable. Set EXPOSE_MONGO_URI_TO_CLIENT=true in backend env to expose it.";

  const listCollections = async () => {
    setIsBusy(true);
    try {
      const result = await apiCall("/api/schema/collections");
      if (!Array.isArray(result?.data)) {
        throw new Error("Unexpected API response while listing collections.");
      }

      setCollectionsOutput(result.data.length > 0 ? result.data.join("\n") : "No collections found.");
      setStatusText(`List all collections successful. Count: ${result.count}`);
    } catch (err) {
      setCollectionsOutput(
        `Unable to load collections.\n\nReason: ${err.message}\nCheck backend CORS and API URL.`
      );
      setStatusText(`List all collections failed: ${err.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const describeCollection = async () => {
    if (!describeName.trim()) {
      setStatusText("Please enter a collection name to describe.");
      return;
    }

    setIsBusy(true);
    try {
      const result = await apiCall(`/api/schema/collections/${encodeURIComponent(describeName.trim())}`);
      setDescribeOutput(prettify(result.data));
      setStatusText(`Describe collection successful: ${describeName.trim()}`);
    } catch (err) {
      setDescribeOutput("Collection not found or not accessible.");
      setStatusText(`Describe collection failed: ${err.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const startCreateCollection = async () => {
    if (!createName.trim()) {
      setStatusText("Please enter a collection name before creating.");
      return;
    }

    setIsBusy(true);
    try {
      await apiCall(`/api/schema/collections/${encodeURIComponent(createName.trim())}`);
      setShowSchemaBuilder(false);
      setStatusText(
        `Collection '${createName.trim()}' already exists. Choose a new name or use Describe.`
      );
    } catch (err) {
      if (err.message.includes("Collection not found")) {
        setShowSchemaBuilder(true);
        setStatusText(
          `Collection '${createName.trim()}' does not exist. Define variables and click Submit.`
        );
      } else {
        setStatusText(`Create flow check failed: ${err.message}`);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const addRow = () => {
    setRows((prev) => [...prev, { ...DEFAULT_FIELD }]);
  };

  const updateRow = (index, key, value) => {
    setRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]: key === "required" ? Boolean(value) : value,
            }
          : row
      )
    );
  };

  const clearBuilder = () => {
    setRows([{ ...DEFAULT_FIELD }]);
    setShowSchemaBuilder(false);
  };

  const addEditRow = () => {
    setEditRows((prev) => [...prev, { ...DEFAULT_EDIT_FIELD }]);
  };

  const updateEditRow = (index, key, value) => {
    setEditRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [key]: key === "required" ? Boolean(value) : value,
            }
          : row
      )
    );
  };

  const toggleDeleteEditRow = (index) => {
    setEditRows((prev) =>
      prev.flatMap((row, rowIndex) => {
        if (rowIndex !== index) {
          return [row];
        }

        if (row.isNew) {
          return [];
        }

        return [
          {
            ...row,
            deleted: !row.deleted,
          },
        ];
      })
    );
  };

  const clearEditBuilder = () => {
    setEditRows([{ ...DEFAULT_EDIT_FIELD }]);
    setShowEditBuilder(false);
  };

  const loadCollectionForEdit = async () => {
    if (!editName.trim()) {
      setStatusText("Please enter a collection name to load for editing.");
      return;
    }

    setIsBusy(true);
    try {
      const result = await apiCall(`/api/schema/collections/${encodeURIComponent(editName.trim())}`);
      const editableRows = buildEditableRows(result.data);

      if (editableRows.length === 0) {
        throw new Error("The collection does not expose an editable schema.");
      }

      setEditRows(editableRows);
      setShowEditBuilder(true);
      setDescribeOutput(prettify(result.data));
      setStatusText(`Loaded collection for editing: ${editName.trim()}`);
    } catch (err) {
      setShowEditBuilder(false);
      setEditRows([{ ...DEFAULT_EDIT_FIELD }]);
      setStatusText(`Load for edit failed: ${err.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const submitEditCollection = async () => {
    if (!editName.trim()) {
      setStatusText("Collection name is required for editing.");
      return;
    }

    const normalized = editRows.map((row) => ({
      originalName: row.originalName?.trim() || "",
      name: row.name?.trim() || "",
      bsonType: row.bsonType,
      required: row.required,
      deleted: Boolean(row.deleted),
      isNew: Boolean(row.isNew) || !row.originalName,
    }));

    const activeNames = new Set();
    for (const row of normalized) {
      if (row.deleted) {
        continue;
      }

      if (!row.name) {
        setStatusText("Each active field must have a field name before saving.");
        return;
      }

      if (activeNames.has(row.name)) {
        setStatusText(`Duplicate field name detected: ${row.name}`);
        return;
      }

      activeNames.add(row.name);
    }

    setIsBusy(true);
    try {
      const result = await apiCall(`/api/schema/collections/${encodeURIComponent(editName.trim())}`, {
        method: "PATCH",
        body: JSON.stringify({
          fields: normalized,
        }),
      });

      const refreshed = await apiCall(`/api/schema/collections/${encodeURIComponent(editName.trim())}`);

      setEditRows(buildEditableRows(refreshed.data));
      setDescribeOutput(prettify(refreshed.data));
      setStatusText(
        [
          `Collection schema updated successfully: ${editName.trim()}`,
          `matchedDocuments: ${result.data.matchedDocuments}`,
          `modifiedDocuments: ${result.data.modifiedDocuments}`,
          "commandRan:",
          prettify(result.data.commandRan),
          "updatedSchema:",
          prettify(result.data.updatedSchema),
        ].join("\n")
      );
    } catch (err) {
      setStatusText(`Edit failed: ${err.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  const submitCollection = async () => {
    if (!createName.trim()) {
      setStatusText("Collection name is required.");
      return;
    }

    const sanitized = rows
      .map((row) => ({
        name: row.name.trim(),
        bsonType: row.bsonType,
        required: row.required,
      }))
      .filter((row) => row.name.length > 0);

    if (sanitized.length === 0) {
      setStatusText("Add at least one valid variable name before submit.");
      return;
    }

    setIsBusy(true);
    try {
      const result = await apiCall("/api/schema/collections", {
        method: "POST",
        body: JSON.stringify({
          collectionName: createName.trim(),
          fields: sanitized,
        }),
      });

      const schemaLookup = await apiCall(
        `/api/schema/collections/${encodeURIComponent(createName.trim())}`
      );

      setDescribeOutput(prettify(schemaLookup.data));
      setStatusText(
        [
          `Collection added successfully: ${createName.trim()}`,
          `returnCode: ${result.returnCode}`,
          "commandRan:",
          prettify(result.commandRan),
          "schemaQueryResult:",
          prettify(schemaLookup.data),
        ].join("\n")
      );

      clearBuilder();
      await listCollections();
    } catch (err) {
      setStatusText(`Submit failed: ${err.message}`);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="background-glow" />
      <main className="container">
        <section className="card status-panel">
          <div className="status-row">
            <strong>Frontend to Backend URL:</strong>
            <span>{API_BASE_URL}</span>
          </div>
          <div className="status-row">
            <strong>Last portfolio fetch:</strong>
            <span>{formatTime(lastDataFetchAt)}</span>
          </div>
          <div className="status-row">
            <strong>Backend healthcheck:</strong>
            <span className="status-value">
              <span
                className={backendFresh ? "status-dot-green" : "status-dot-red"}
                aria-hidden="true"
              />
              {backendFresh ? "Healthy" : "Stale or unavailable"}
              {lastDataFetchAt ? ` (last success ${formatTime(lastDataFetchAt)})` : ""}
            </span>
          </div>
          <div className="status-row">
            <strong>Health endpoint:</strong>
            <span>{systemStatus?.backend?.healthcheckUrl || `${API_BASE_URL}/api/health`}</span>
          </div>
          <div className="status-row">
            <strong>Backend to MongoDB host:</strong>
            <span>{mongoUriToShow}</span>
          </div>
          <div className="status-row">
            <strong>MongoDB database:</strong>
            <span>{systemStatus?.database?.dbName || "Not available"}</span>
          </div>
          <div className="status-row">
            <strong>MongoDB connection status:</strong>
            <span className="status-value">
              <span
                className={mongoFresh ? "status-dot-green" : "status-dot-red"}
                aria-hidden="true"
              />
              {mongoFresh ? "Connected recently" : "Not connected in last 60 mins"}
              {systemStatus?.database?.state ? ` (${systemStatus.database.state})` : ""}
            </span>
          </div>
          <div className="status-row">
            <strong>MongoDB last connected:</strong>
            <span>{formatTime(systemStatus?.database?.lastConnectedAt)}</span>
          </div>
        </section>

        <section className="hero card">
          <h1>Mongo Collection Schema Maker</h1>
          <p>
            Build and inspect MongoDB collections from a visual form, powered by your
            Render-hosted backend API.
          </p>
          <p className="muted">Backend API: {API_BASE_URL}</p>
        </section>

        <section className="card">
          <h2>1) List all Collections</h2>
          <button type="button" onClick={listCollections} disabled={isBusy}>
            List all Collections
          </button>
          <textarea value={collectionsOutput} readOnly rows={8} />
        </section>

        <section className="card">
          <h2>2) Describe a selected collection</h2>
          <div className="inline-row">
            <input
              type="text"
              placeholder="Enter collection name"
              value={describeName}
              onChange={(event) => setDescribeName(event.target.value)}
            />
            <button type="button" onClick={describeCollection} disabled={isBusy}>
              Describe selected collection
            </button>
          </div>
          <textarea value={describeOutput} readOnly rows={10} />
        </section>

        <section className="card">
          <h2>3) Create a new collection</h2>
          <div className="inline-row">
            <input
              type="text"
              placeholder="New collection name"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
            />
            <button type="button" onClick={startCreateCollection} disabled={isBusy}>
              Create a new collection
            </button>
          </div>

          {showSchemaBuilder && (
            <div className="builder">
              <h3>Define collection variables</h3>
              {rows.map((row, index) => (
                <div key={`${index}-${row.name}`} className="builder-row">
                  <input
                    type="text"
                    placeholder="Variable"
                    value={row.name}
                    onChange={(event) => updateRow(index, "name", event.target.value)}
                  />

                  <select
                    value={row.bsonType}
                    onChange={(event) => updateRow(index, "bsonType", event.target.value)}
                  >
                    {supportedTypes.map((type) => (
                      <option value={type} key={type}>
                        {type}
                      </option>
                    ))}
                  </select>

                  <label className="required-box">
                    <input
                      type="checkbox"
                      checked={row.required}
                      onChange={(event) => updateRow(index, "required", event.target.checked)}
                    />
                    Required
                  </label>

                  <button type="button" className="icon-btn" onClick={addRow}>
                    +
                  </button>
                </div>
              ))}

              <div className="builder-actions">
                <button type="button" onClick={submitCollection} disabled={isBusy}>
                  Submit
                </button>
                <button type="button" className="secondary" onClick={clearBuilder} disabled={isBusy}>
                  Clear
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <h2>4) Edit an existing collection</h2>
          <div className="inline-row">
            <input
              type="text"
              placeholder="Collection name to edit"
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
            />
            <button type="button" onClick={loadCollectionForEdit} disabled={isBusy}>
              Load collection schema
            </button>
          </div>

          {showEditBuilder && (
            <div className="builder">
              <h3>Edit collection fields</h3>
              {editRows.map((row, index) => (
                <SchemaFieldRow
                  key={`${row.originalName || row.name || "new"}-${index}`}
                  row={row}
                  index={index}
                  supportedTypes={supportedTypes}
                  mode="edit"
                  onChange={updateEditRow}
                  onAddRow={addEditRow}
                  onToggleDelete={toggleDeleteEditRow}
                />
              ))}

              <div className="builder-actions">
                <button type="button" onClick={submitEditCollection} disabled={isBusy}>
                  Save schema changes
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={clearEditBuilder}
                  disabled={isBusy}
                >
                  Close editor
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <h2>Status</h2>
          <textarea value={statusText} readOnly rows={14} />
        </section>
      </main>
    </div>
  );
}
