import { Client } from "pg";
import { cleanDescription, sanitizeIdentifier } from "../utils/naming";
import type { ParamSpec, ParamType, ToolSpec } from "../types";

const NOT_IMPLEMENTED =
  "introspection is not yet implemented — contributions welcome! See CONTRIBUTING.md to add a provider.";

/**
 * Connect to a database, introspect its schema, and emit CRUD MCP tools.
 * Only Postgres is implemented today; MySQL/MongoDB are intentionally stubbed
 * with a friendly pointer so the community can extend them.
 */
export async function introspectDatabase(
  provider: string,
  uri: string,
): Promise<ToolSpec[]> {
  switch (provider) {
    case "postgres":
      return introspectPostgres(uri);
    case "mysql":
      throw new Error(`MySQL ${NOT_IMPLEMENTED}`);
    case "mongodb":
      throw new Error(`MongoDB ${NOT_IMPLEMENTED}`);
    default:
      throw new Error(
        `Unknown provider "${provider}". Supported: postgres (mysql, mongodb coming soon).`,
      );
  }
}

interface Column {
  name: string;
  type: ParamType;
  nullable: boolean;
  isPrimaryKey: boolean;
}

async function introspectPostgres(uri: string): Promise<ToolSpec[]> {
  const client = new Client({ connectionString: uri });
  try {
    await client.connect();
  } catch (err) {
    throw new Error(
      `Could not connect to Postgres (${(err as Error).message}). ` +
        `Check the --uri host/port/credentials and that the database is reachable.`,
    );
  }
  try {
    const columnsRes = await client.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT table_name, column_name, data_type, is_nullable
         FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position`,
    );

    const pkRes = await client.query<{
      table_name: string;
      column_name: string;
    }>(
      `SELECT kcu.table_name, kcu.column_name
         FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = 'public'`,
    );

    const primaryKeys = new Map<string, Set<string>>();
    for (const row of pkRes.rows) {
      if (!primaryKeys.has(row.table_name)) {
        primaryKeys.set(row.table_name, new Set());
      }
      primaryKeys.get(row.table_name)!.add(row.column_name);
    }

    const tables = new Map<string, Column[]>();
    for (const row of columnsRes.rows) {
      const pk = primaryKeys.get(row.table_name);
      const col: Column = {
        name: sanitizeIdentifier(row.column_name),
        type: mapPgType(row.data_type),
        nullable: row.is_nullable === "YES",
        isPrimaryKey: pk?.has(row.column_name) ?? false,
      };
      if (!tables.has(row.table_name)) tables.set(row.table_name, []);
      tables.get(row.table_name)!.push(col);
    }

    const tools: ToolSpec[] = [];
    for (const [table, columns] of tables) {
      tools.push(...buildCrudTools(table, columns));
    }
    return tools;
  } finally {
    await client.end();
  }
}

function buildCrudTools(table: string, columns: Column[]): ToolSpec[] {
  const safeTable = sanitizeIdentifier(table);
  const keyCols = columns.filter((c) => c.isPrimaryKey);
  const nonKeyCols = columns.filter((c) => !c.isPrimaryKey);

  const keyParams: ParamSpec[] = keyCols.map((c) => ({
    name: c.name,
    type: c.type,
    required: true,
    description: cleanDescription(`Primary key (${c.name}) of ${table}`),
  }));

  const tools: ToolSpec[] = [];

  // list_<table>: always available.
  tools.push({
    name: `list_${safeTable}`,
    description: `List rows from the ${table} table.`,
    params: [
      { name: "limit", type: "integer", required: false, description: "Max rows to return." },
      { name: "offset", type: "integer", required: false, description: "Rows to skip." },
    ],
    source: "database",
    operation: "list",
    table,
  });

  // create_<table>: always available.
  tools.push({
    name: `create_${safeTable}`,
    description: `Insert a new row into the ${table} table.`,
    params: nonKeyCols.map((c) => ({
      name: c.name,
      type: c.type,
      required: !c.nullable,
    })),
    source: "database",
    operation: "create",
    table,
  });

  // get/update/delete need a primary key to address a single row.
  if (keyCols.length > 0) {
    tools.push({
      name: `get_${safeTable}`,
      description: `Fetch a single ${table} row by primary key.`,
      params: keyParams,
      source: "database",
      operation: "get",
      table,
    });
    tools.push({
      name: `update_${safeTable}`,
      description: `Update a ${table} row by primary key.`,
      params: [
        ...keyParams,
        ...nonKeyCols.map((c) => ({
          name: c.name,
          type: c.type,
          required: false,
        })),
      ],
      source: "database",
      operation: "update",
      table,
    });
    tools.push({
      name: `delete_${safeTable}`,
      description: `Delete a ${table} row by primary key.`,
      params: keyParams,
      source: "database",
      operation: "delete",
      table,
    });
  }

  return tools;
}

function mapPgType(dataType: string): ParamType {
  const t = dataType.toLowerCase();
  if (/(int|serial|bigint|smallint)/.test(t)) return "integer";
  if (/(numeric|decimal|real|double)/.test(t)) return "number";
  if (t === "boolean") return "boolean";
  if (/json/.test(t)) return "object";
  if (t.includes("array")) return "array";
  return "string";
}
