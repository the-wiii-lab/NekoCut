import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("pruneAutoRecordings", () => {
	let tempRoot: string;
	let appDataPath: string;
	let userDataPath: string;
	let tempPath: string;
	let appPath: string;

	beforeEach(async () => {
		tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "nekocut-prune-"));
		appDataPath = path.join(tempRoot, "AppData");
		userDataPath = path.join(tempRoot, "UserData");
		tempPath = path.join(tempRoot, "Temp");
		appPath = path.join(tempRoot, "App");

		await Promise.all(
			[appDataPath, userDataPath, tempPath, appPath].map((dirPath) =>
				fs.mkdir(dirPath, { recursive: true }),
			),
		);

		vi.resetModules();
		vi.doMock("electron", () => ({
			app: {
				isPackaged: false,
				getAppPath: () => appPath,
				getPath: (name: string) => {
					if (name === "appData") return appDataPath;
					if (name === "userData") return userDataPath;
					if (name === "temp") return tempPath;
					return tempRoot;
				},
				setPath: () => undefined,
			},
		}));
	});

	afterEach(async () => {
		vi.resetModules();
		vi.doUnmock("electron");
		if (tempRoot) {
			await fs.rm(tempRoot, { recursive: true, force: true });
		}
	});

	it("preserves recordings referenced by saved projects in the Projects directory", async () => {
		const { getRecordingsDir } = await import("../utils");
		const { PROJECTS_DIRECTORY_NAME, PROJECT_FILE_EXTENSION } = await import("../constants");
		const { pruneAutoRecordings } = await import("./prune");

		const recordingsDir = await getRecordingsDir();
		const projectsDir = path.join(recordingsDir, PROJECTS_DIRECTORY_NAME);
		await fs.mkdir(projectsDir, { recursive: true });

		const recordingPaths: string[] = [];
		for (let index = 0; index < 23; index += 1) {
			const recordingPath = path.join(recordingsDir, `recording-${index}.mp4`);
			recordingPaths.push(recordingPath);
			await fs.writeFile(recordingPath, `video-${index}`);
			const timestamp = new Date(Date.now() - index * 60_000);
			await fs.utimes(recordingPath, timestamp, timestamp);
		}

		const protectedVideoRecordingPath = recordingPaths.at(-3);
		const protectedWebcamRecordingPath = recordingPaths.at(-2);
		const prunableRecordingPath = recordingPaths.at(-1);

		await fs.writeFile(
			path.join(projectsDir, `saved-project-video.${PROJECT_FILE_EXTENSION}`),
			JSON.stringify(
				{
					videoPath: protectedVideoRecordingPath,
				},
				null,
				2,
			),
			"utf-8",
		);

		await fs.writeFile(
			path.join(projectsDir, `saved-project-webcam.${PROJECT_FILE_EXTENSION}`),
			JSON.stringify(
				{
					editor: {
						webcam: {
							sourcePath: protectedWebcamRecordingPath,
						},
					},
				},
				null,
				2,
			),
			"utf-8",
		);

		await pruneAutoRecordings();

		await expect(fs.access(protectedVideoRecordingPath!)).resolves.toBeUndefined();
		await expect(fs.access(protectedWebcamRecordingPath!)).resolves.toBeUndefined();
		await expect(fs.access(prunableRecordingPath!)).rejects.toThrow();
	});

	it("aborts pruning when a saved project cannot be parsed", async () => {
		const { getRecordingsDir } = await import("../utils");
		const { PROJECTS_DIRECTORY_NAME, PROJECT_FILE_EXTENSION } = await import("../constants");
		const { pruneAutoRecordings } = await import("./prune");

		const recordingsDir = await getRecordingsDir();
		const projectsDir = path.join(recordingsDir, PROJECTS_DIRECTORY_NAME);
		await fs.mkdir(projectsDir, { recursive: true });

		const recordingPath = path.join(recordingsDir, "recording-stale.mp4");
		await fs.writeFile(recordingPath, "video");
		const staleTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1_000);
		await fs.utimes(recordingPath, staleTimestamp, staleTimestamp);

		await fs.writeFile(
			path.join(projectsDir, `broken-project.${PROJECT_FILE_EXTENSION}`),
			"{ invalid json",
			"utf-8",
		);

		await expect(pruneAutoRecordings()).rejects.toThrow();
		await expect(fs.access(recordingPath)).resolves.toBeUndefined();
	});
});
