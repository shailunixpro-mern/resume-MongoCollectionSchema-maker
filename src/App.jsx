import { useMemo, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://resume-backend-fnjs.onrender.com";

const DEFAULT_FIELD = { name: "", bsonType: "string", required: true };

const prettify = (value) => JSON.stringify(value, null, 2);

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

  const [createName, setCreateName] = useState("");
  const [rows, setRows] = useState([{ ...DEFAULT_FIELD }]);
  const [showSchemaBuilder, setShowSchemaBuilder] = useState(false);

  const [statusText, setStatusText] = useState("Status messages and command output will appear here.");
  const [isBusy, setIsBusy] = useState(false);

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
          <h2>Status</h2>
          <textarea value={statusText} readOnly rows={14} />
        </section>
      </main>
    </div>
  );
}
