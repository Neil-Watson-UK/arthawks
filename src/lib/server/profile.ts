import type { OnboardUserType } from '$lib/constants/routes';
import type { UserType } from '$lib/types/database';
import {
	classifyOnboardInput,
	isOnboardUserType,
	resolveOnboardUserType
} from '$lib/onboard';

export { classifyOnboardInput, isOnboardUserType, resolveOnboardUserType };

/*
 * Map gateway audience to Supabase profiles.user_type.
 * All three roles persist so Identity Switcher and RLS stay aligned.
 */
export function onboardTypeToProfileUserType(userType: OnboardUserType): UserType {
	return userType;
}
