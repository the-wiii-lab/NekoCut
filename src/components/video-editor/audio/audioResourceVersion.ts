export function getAudioResourceVersionKey(resource: string, version = 0): string {
	const safeVersion = Number.isFinite(version) ? Math.max(0, Math.trunc(version)) : 0;
	return `${resource}::nekocut-audio-v${safeVersion}`;
}

function parseLoopbackMediaServerUrl(resourceUrl: string): URL | null {
	try {
		const url = new URL(resourceUrl);
		const isLoopbackMediaServer =
			(url.protocol === "http:" || url.protocol === "https:") &&
			(url.hostname === "127.0.0.1" || url.hostname === "localhost") &&
			url.pathname === "/video";
		return isLoopbackMediaServer ? url : null;
	} catch {
		return null;
	}
}

export function getAudioResourceCacheScope(resourceUrl: string): string {
	const url = parseLoopbackMediaServerUrl(resourceUrl);
	if (!url) {
		return resourceUrl;
	}

	url.searchParams.delete("nekocutAudioVersion");
	return url.href;
}

export function getVersionedAudioResourceUrl(resourceUrl: string, version = 0): string {
	const safeVersion = Number.isFinite(version) ? Math.max(0, Math.trunc(version)) : 0;
	if (safeVersion === 0) {
		return resourceUrl;
	}

	const url = parseLoopbackMediaServerUrl(resourceUrl);
	if (!url) {
		return resourceUrl;
	}

	url.searchParams.set("nekocutAudioVersion", String(safeVersion));
	return url.href;
}

export function isAudioResourceLoadCurrent(
	resources: ReadonlyMap<string, string>,
	resource: string,
	expectedKey: string,
): boolean {
	return resources.get(resource) === expectedKey;
}
