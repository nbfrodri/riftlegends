import {
	RoleIcon,
	type RoleIconProps,
} from "@rift-legends/ui-kit/components/role-icon";
import { useAssetSrc } from ".";

/** The official role icon when the content cache is ready; the own one otherwise. */
export function GameRoleIcon(props: Omit<RoleIconProps, "src">) {
	const src = useAssetSrc("cdragon", `roles/${props.role}.png`);
	return <RoleIcon {...props} src={src} />;
}
