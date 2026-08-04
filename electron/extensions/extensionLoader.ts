/**
 * Extension Loader — Main Process
 *
 * Discovers, validates, and manages extensions installed in the
 * extensions directory (~/.nekocut/extensions/ or userData/extensions/).
 *
 * Extensions are loaded from disk by reading their manifest files.
 * The actual extension code runs in the renderer process and uses the
 * permission-gated host API exposed by the renderer.
 */

import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { app } from "electron";
import type { ExtensionInfo, ExtensionManifest, ExtensionStatus } from "./extensionTypes";

const EXTENSIONS_DIR_NAME = "extensions";
const MANIFEST_FILE_NAME = "nekocut-extension.json";
const BUILTIN_EXTENSIONS_DIR = "builtin-extensions";
const EXTENSION_STATE_FILE_NAME = "extension-state.json";

/** In-memory registry of loaded extensions */
const extensionRegistry = new Map<string, ExtensionInfo>();

type PersistedExtensionStatus = Extract<ExtensionStatus, "active" | "disabled" | "installed">;

/**
 * Returns the directory where user-installed extensions live.
 */
export function getExtensionsDirectory(): string {
	return path.join(app.getPath("userData"), EXTENSIONS_DIR_NAME);
}

/**
 * Returns the built-in extensions directory (shipped with the app).
 */
function getBuiltinExtensionsDirectory(): string {
	if (app.isPackaged) {
		return path.join(process.resourcesPath, BUILTIN_EXTENSIONS_DIR);
	}
	return path.join(app.getAppPath(), "public", BUILTIN_EXTENSIONS_DIR);
}

function getExtensionStateFilePath(): string {
	return path.join(app.getPath("userData"), EXTENSION_STATE_FILE_NAME);
}

function isPersistedExtensionStatus(value: unknown): value is PersistedExtensionStatus {
	return value === "active" || value === "disabled" || value === "installed";
}

async function readPersistedExtensionStatuses(): Promise<Record<string, PersistedExtensionStatus>> {
	const stateFile = getExtensionStateFilePath();
	if (!existsSync(stateFile)) {
		return {};
	}

	try {
		const raw = await fs.readFile(stateFile, "utf-8");
		const parsed = JSON.parse(raw);

		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			return {};
		}

		const entries = Object.entries(parsed).filter(
			([key, value]) => typeof key === "string" && isPersistedExtensionStatus(value),
		);

		return Object.fromEntries(entries) as Record<string, PersistedExtensionStatus>;
	} catch {
		return {};
	}
}

async function writePersistedExtensionStatuses(
	statuses: Record<string, PersistedExtensionStatus>,
): Promise<void> {
	const stateFile = getExtensionStateFilePath();
	await fs.mkdir(path.dirname(stateFile), { recursive: true });
	await fs.writeFile(stateFile, JSON.stringify(statuses, null, 2), "utf-8");
}

async function updatePersistedExtensionStatus(
	id: string,
	status: PersistedExtensionStatus | null,
): Promise<void> {
	const statuses = await readPersistedExtensionStatuses();

	if (status) {
		statuses[id] = status;
	} else {
		delete statuses[id];
	}

	await writePersistedExtensionStatuses(statuses);
}

/**
 * Ensure the extensions directory exists.
 */
async function ensureExtensionsDirectory(): Promise<void> {
	const dir = getExtensionsDirectory();
	await fs.mkdir(dir, { recursive: true });
}

/**
 * Validate an extension manifest for required fields and safe values.
 */
function validateManifest(manifest: unknown, extensionPath: string): ExtensionManifest | null {
	if (!manifest || typeof manifest !== "object") {
		return null;
	}

	const m = manifest as Record<string, unknown>;

	// Required fields
	if (typeof m.id !== "string" || m.id.length === 0) return null;
	// Only allow safe characters in extension IDs
	if (!/^[a-z0-9][a-z0-9._-]*$/i.test(m.id)) return null;
	if (typeof m.name !== "string" || m.name.length === 0) return null;
	if (typeof m.version !== "string") return null;
	if (typeof m.main !== "string" || m.main.length === 0) return null;

	// Validate main entry doesn't escape extension directory
	const resolvedMain = path.resolve(extensionPath, m.main);
	const relativeMain = path.relative(extensionPath, resolvedMain);
	if (relativeMain.startsWith("..") || path.isAbsolute(relativeMain)) {
		console.warn(`[extensions] Extension ${m.id}: main entry escapes extension directory`);
		return null;
	}

	// Validate permissions array
	const validPermissions = new Set([
		"render",
		"cursor",
		"audio",
		"timeline",
		"ui",
		"assets",
		"export",
	]);
	const permissions = Array.isArray(m.permissions) ? m.permissions : [];
	const safePermissions = permissions.filter(
		(p): p is string => typeof p === "string" && validPermissions.has(p),
	);

	return {
		id: m.id as string,
		name: m.name as string,
		version: m.version as string,
		description: typeof m.description === "string" ? m.description : "",
		author: typeof m.author === "string" ? m.author : undefined,
		homepage: typeof m.homepage === "string" ? m.homepage : undefined,
		license: typeof m.license === "string" ? m.license : undefined,
		engine: typeof m.engine === "string" ? m.engine : undefined,
		icon: typeof m.icon === "string" ? m.icon : undefined,
		main: m.main as string,
		permissions: safePermissions as ExtensionManifest["permissions"],
		contributes:
			typeof m.contributes === "object" && m.contributes !== null
				? (m.contributes as ExtensionManifest["contributes"])
				: undefined,
	};
}

/**
 * Scan a directory for extensions (each subdirectory with a manifest).
 */
async function scanExtensionsIn(directory: string, builtin: boolean): Promise<ExtensionInfo[]> {
	const results: ExtensionInfo[] = [];

	if (!existsSync(directory)) {
		return results;
	}

	let entries: string[];
	try {
		entries = await fs.readdir(directory);
	} catch {
		return results;
	}

	for (const entry of entries) {
		const extDir = path.join(directory, entry);

		// Skip non-directories (lstat — don't follow symlinks)
		let stat;
		try {
			stat = await fs.lstat(extDir);
		} catch {
			continue;
		}
		if (!stat.isDirectory()) continue;

		const manifestPath = path.join(extDir, MANIFEST_FILE_NAME);
		if (!existsSync(manifestPath)) continue;

		try {
			const raw = await fs.readFile(manifestPath, "utf-8");
			const parsed = JSON.parse(raw);
			const manifest = validateManifest(parsed, extDir);

			if (!manifest) {
				results.push({
					manifest: {
						id: entry,
						name: entry,
						version: "0.0.0",
						main: "",
						permissions: [],
						description: "Invalid manifest",
					},
					status: "error",
					path: extDir,
					error: "Invalid or incomplete manifest",
					builtin,
				});
				continue;
			}

			// Check that the entry file exists
			const entryPath = path.join(extDir, manifest.main);
			if (!existsSync(entryPath)) {
				results.push({
					manifest,
					status: "error",
					path: extDir,
					error: `Entry file not found: ${manifest.main}`,
					builtin,
				});
				continue;
			}

			results.push({
				manifest,
				status: "installed",
				path: extDir,
				builtin,
			});
		} catch (err) {
			results.push({
				manifest: {
					id: entry,
					name: entry,
					version: "0.0.0",
					main: "",
					permissions: [],
					description: "Failed to load",
				},
				status: "error",
				path: extDir,
				error: String(err),
				builtin,
			});
		}
	}

	return results;
}

/**
 * Discover and register all available extensions (builtin + user-installed).
 */
export async function discoverExtensions(): Promise<ExtensionInfo[]> {
	await ensureExtensionsDirectory();

	const builtinDir = getBuiltinExtensionsDirectory();
	const userDir = getExtensionsDirectory();

	const [builtinExts, userExts] = await Promise.all([
		scanExtensionsIn(builtinDir, true),
		scanExtensionsIn(userDir, false),
	]);

	const persistedStatuses = await readPersistedExtensionStatuses();
	const applyPersistedStatus = (ext: ExtensionInfo): ExtensionInfo => {
		if (ext.status === "error") {
			return ext;
		}

		return {
			...ext,
			status: persistedStatuses[ext.manifest.id] ?? (ext.builtin ? "active" : "installed"),
		};
	};

	const normalizedBuiltinExts = builtinExts.map(applyPersistedStatus);
	const normalizedUserExts = userExts.map(applyPersistedStatus);

	// User extensions override builtin ones with the same ID
	extensionRegistry.clear();
	for (const ext of normalizedBuiltinExts) {
		extensionRegistry.set(ext.manifest.id, ext);
	}
	for (const ext of normalizedUserExts) {
		extensionRegistry.set(ext.manifest.id, ext);
	}

	return Array.from(extensionRegistry.values());
}

/**
 * Get all registered extensions.
 */
export function getRegisteredExtensions(): ExtensionInfo[] {
	return Array.from(extensionRegistry.values());
}

/**
 * Get a specific extension by ID.
 */
export function getExtension(id: string): ExtensionInfo | undefined {
	return extensionRegistry.get(id);
}

/**
 * Enable or disable an extension.
 */
export async function setExtensionStatus(id: string, status: ExtensionStatus): Promise<boolean> {
	const ext = extensionRegistry.get(id);
	if (!ext) return false;
	ext.status = status;

	if (status === "active" || status === "disabled" || status === "installed") {
		await updatePersistedExtensionStatus(id, status);
	}

	return true;
}

/**
 * Install an extension from a directory (copy to extensions dir).
 */
export async function installExtensionFromPath(sourcePath: string): Promise<ExtensionInfo | null> {
	const manifestPath = path.join(sourcePath, MANIFEST_FILE_NAME);
	if (!existsSync(manifestPath)) {
		return null;
	}

	let manifest: ExtensionManifest | null;
	try {
		const raw = await fs.readFile(manifestPath, "utf-8");
		manifest = validateManifest(JSON.parse(raw), sourcePath);
	} catch {
		return null;
	}

	if (!manifest) return null;

	const targetDir = path.join(getExtensionsDirectory(), manifest.id);

	// Remove existing version if present
	if (existsSync(targetDir)) {
		await fs.rm(targetDir, { recursive: true, force: true });
	}

	await fs.cp(sourcePath, targetDir, { recursive: true });

	const info: ExtensionInfo = {
		manifest,
		status: "installed",
		path: targetDir,
	};

	extensionRegistry.set(manifest.id, info);
	await updatePersistedExtensionStatus(manifest.id, "installed");
	return info;
}

/**
 * Uninstall a user extension (cannot uninstall builtin).
 */
export async function uninstallExtension(id: string): Promise<boolean> {
	const ext = extensionRegistry.get(id);
	if (!ext || ext.builtin) return false;

	try {
		await fs.rm(ext.path, { recursive: true, force: true });
		extensionRegistry.delete(id);
		await updatePersistedExtensionStatus(id, null);
		return true;
	} catch {
		return false;
	}
}
