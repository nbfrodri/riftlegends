export const pingChannel = "riftlegends:ping";

export interface RiftLegendsAPI {
	ping(): Promise<"pong">;
}

declare global {
	interface Window {
		readonly riftlegends: RiftLegendsAPI;
	}
}
