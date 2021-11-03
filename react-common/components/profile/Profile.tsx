/// <reference path="../types.d.ts" />

import * as React from "react";
import { BadgeList } from "./BadgeList";
import { UserPane } from "./UserPane";
import { BadgeInfo } from "./BadgeInfo";

export interface ProfileProps {
    user: pxt.auth.State;
    signOut: () => void;
    deleteProfile: () => void;
    notification?: pxt.ProfileNotification;
    showModalAsync(options: DialogOptions): Promise<void>;
}

export const Profile = (props: ProfileProps) => {
    const { user, signOut, deleteProfile, notification, showModalAsync } = props;

    const userProfile = user?.profile || { idp: {} };
    const userBadges = user?.preferences?.badges || { badges: [] };

    const onBadgeClick = (badge: pxt.auth.Badge) => {
        showModalAsync({
            header: lf("{0} Badge", badge.title),
            size: "tiny",
            hasCloseIcon: true,
            jsx: <BadgeInfo badge={badge} />
        });
    }

    return <div className="user-profile">
        <UserPane profile={userProfile} onSignOutClick={signOut} onDeleteProfileClick={deleteProfile} notification={notification} />
        <BadgeList
            availableBadges={pxt.appTarget.defaultBadges || []}
            userState={userBadges}
            onBadgeClick={onBadgeClick}
        />
    </div>
}