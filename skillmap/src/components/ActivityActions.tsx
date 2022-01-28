import * as React from "react";
import { connect } from 'react-redux';

import { dispatchOpenActivity, dispatchShowRestartActivityWarning, dispatchShowShareModal, dispatchShowCarryoverModal } from '../actions/dispatch';

import { ActivityStatus, isCodeCarryoverEnabled } from '../lib/skillMapUtils';
import { tickEvent } from '../lib/browserUtils';
import { editorUrl } from "./makecodeFrame";
import { SkillMapState } from "../store/reducer";

import { Button } from "react-common/controls/Button";

interface OwnProps {
    mapId: string;
    activityId: string;
    status?: ActivityStatus;
    completedHeaderId?: string;
    showCodeCarryoverModal?: boolean;
}

interface DispatchProps {
    dispatchOpenActivity: (mapId: string, activityId: string) => void;
    dispatchShowRestartActivityWarning: (mapId: string, activityId: string) => void;
    dispatchShowShareModal: (mapId: string, activityId: string) => void;
    dispatchShowCarryoverModal: (mapId: string, activityId: string) => void;
}

type ActivityActionsProps = OwnProps & DispatchProps;

export class ActivityActionsImpl extends React.Component<ActivityActionsProps> {
    protected getActivityActionText(): string {
        switch (this.props.status) {
            case "locked":
                return lf("Locked");
            case "completed":
                return lf("View Code");
            case "inprogress":
            case "restarted":
                return lf("Continue");
            case "notstarted":
            default:
                return lf("Start");
        }
    }

    protected isCompleted(status: ActivityStatus): boolean {
        return status === "completed" || status === "restarted";
    }

    protected handleActionButtonClick = () => {
        const { status, mapId, activityId, dispatchOpenActivity, dispatchShowCarryoverModal, showCodeCarryoverModal } = this.props;

        if (status === "locked") return;

        tickEvent("skillmap.activity.open", { path: mapId, activity: activityId, status: status || "" });
        switch (status) {
            case "notstarted":
                if (showCodeCarryoverModal) {
                    dispatchShowCarryoverModal(mapId, activityId);
                } else {
                    dispatchOpenActivity(mapId, activityId);
                }
                break;
            case "completed":
            case "inprogress":
            case "restarted":
            default:
                dispatchOpenActivity(mapId, activityId);
        }
    }

    protected handleRestartButtonClick = () => {
        const { mapId, activityId, status, dispatchShowRestartActivityWarning } = this.props;
        tickEvent("skillmap.sidebar.restart", { path: mapId, activity: activityId, status: status || "" });
        dispatchShowRestartActivityWarning(mapId, activityId);
    }

    protected handleShareButtonClick = () => {
        const { mapId, activityId, status, dispatchShowShareModal } = this.props;
        tickEvent("skillmap.sidebar.share", { path: mapId, activity: activityId, status: status || "" });
        dispatchShowShareModal(mapId, activityId);
    }

    protected handleSaveToProjectsClick = () => {
        const { completedHeaderId, mapId, activityId } = this.props;
        tickEvent("skillmap.export", { path: mapId || "", activity: activityId || "" });
        window.open(`${editorUrl}#skillmapimport:${completedHeaderId}`)
    }

    render() {
        const { status, completedHeaderId } = this.props;
        const activityStarted = (status && status !== "notstarted" && status !== "locked");

        if (status === "locked") return <div />

        // Apply "grid" class when there are four actions (for a completed activity)
        return <div className={`actions ${completedHeaderId ? "grid" : ""}`}>
            <Button
                className="primary inverted"
                tabIndex={-1}
                title={this.getActivityActionText()}
                label={this.getActivityActionText()}
                onClick={this.handleActionButtonClick}
            />
            {activityStarted && <>
                <Button
                    className="primary inverted"
                    tabIndex={-1}
                    title={lf("Restart")}
                    label={lf("Restart")}
                    onClick={this.handleRestartButtonClick}
                />
                <Button
                    className="primary inverted"
                    tabIndex={-1}
                    title={lf("Share")}
                    label={lf("Share")}
                    onClick={this.handleShareButtonClick}
                />
            </>}
            {completedHeaderId &&
                <Button
                    tabIndex={-1}
                    className="primary inverted"
                    title={lf("Save to My Projects")}
                    label={lf("Save to My Projects")}
                    onClick={this.handleSaveToProjectsClick}
                />
            }
        </div>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};

    const props = ownProps as OwnProps;
    const map = state.maps[props.mapId];
    const activity = map.activities[props.activityId] as MapActivity;
    return {
        showCodeCarryoverModal: isCodeCarryoverEnabled(state.user, state.pageSourceUrl, map, activity)
    };
}

const mapDispatchToProps = {
    dispatchOpenActivity,
    dispatchShowRestartActivityWarning,
    dispatchShowShareModal,
    dispatchShowCarryoverModal
}

export const ActivityActions = connect(mapStateToProps, mapDispatchToProps)(ActivityActionsImpl);