/// <reference path="../lib/skillMap.d.ts" />

import * as React from "react";
import { connect } from 'react-redux';
import { ModalType, ShareState, SkillMapState } from '../store/reducer';
import { dispatchHideModal, dispatchRestartActivity, dispatchShowShareModal, dispatchOpenActivity, dispatchResetUser, dispatchShowCarryoverModal, dispatchSetShareStatus, dispatchCloseUserProfile } from '../actions/dispatch';
import { tickEvent, postAbuseReportAsync, resolvePath, postShareAsync } from "../lib/browserUtils";
import { lookupActivityProgress, lookupPreviousActivityStates, lookupPreviousCompletedActivityState, isCodeCarryoverEnabled } from "../lib/skillMapUtils";
import { getProjectAsync } from "../lib/workspaceProvider";
import { editorUrl } from "./makecodeFrame";

import { Modal, ModalAction } from './Modal';

interface AppModalProps {
    type: ModalType;
    skillMap?: SkillMap;
    userState?: UserState;
    mapId: string;
    activity?: MapNode;
    pageSourceUrl?: string;
    actions?: ModalAction[];
    showCodeCarryoverModal?: boolean;
    shareState?: ShareState;
    dispatchHideModal: () => void;
    dispatchRestartActivity: (mapId: string, activityId: string, previousHeaderId?: string, carryoverCode?: boolean) => void;
    dispatchOpenActivity: (mapId: string, activityId: string, previousHeaderId?: string, carryoverCode?: boolean) => void;
    dispatchShowCarryoverModal: (mapId: string, activityId: string) => void;
    dispatchCloseUserProfile: () => void;
    dispatchResetUser: () => void;
    dispatchSetShareStatus: (headerId?: string, url?: string) => void;
    dispatchShowShareModal: (mapId: string, activityId: string, teamsShare?: boolean) => void;
}

interface AppModalState {
    loading?: boolean;
    data?: ShareModalData;
    checkboxSelected?: boolean; // For the Login modal and delete confirmation
}

interface ShareModalData {
    shortId: string;
}

export class AppModalImpl extends React.Component<AppModalProps, AppModalState> {
    constructor (props: AppModalProps) {
        super(props);
        this.state = {};
    }

    render() {
        const  { activity, type } = this.props;
        switch (type) {
            case "completion":
                if (!activity) return <div />
                return this.renderCompletionModal();
            case "restart-warning":
                if (!activity) return <div />
                return this.renderRestartWarning();
            case "report-abuse":
                return this.renderReportAbuse();
            case "reset":
                return this.renderResetWarning();
            case "carryover":
                return this.renderCodeCarryoverModal();
            case "share":
                return this.renderShareModal();
            case "login":
                return this.renderLoginModal(false);
            case "login-prompt":
                return this.renderLoginModal(true);
            case "delete-account":
                return this.renderDeleteAccountModal();
            default:
                return <div/>
        }
    }

    protected handleOnClose = () => {
        this.setState({ loading: false, data: undefined, checkboxSelected: false });
        this.props.dispatchHideModal();
        this.props.dispatchSetShareStatus();
    }

    protected handleRewardClick = () => {
        const  { mapId, skillMap, type, activity } = this.props;
        const reward = activity as MapReward;
        tickEvent("skillmap.reward", { path: mapId, activity: reward.activityId });
        window.open(reward.url || skillMap!.completionUrl);
    }

    protected handleRewardShareClick = () => {
        const { mapId, userState, pageSourceUrl, skillMap, activity, shareState } = this.props;
        const previousState = lookupPreviousCompletedActivityState(userState!, pageSourceUrl!, skillMap!, activity!.activityId);
        if (previousState)
            this.props.dispatchShowShareModal(mapId, previousState.activityId, true);
    }

    protected getCompletionActionText(action: MapCompletionAction) {
        switch (action.kind) {
            case "activity":
                return lf("Start Activity")
            case "map":
                return lf("Start Skill Map")
            case "editor":
                return lf("Keep Building")
            case "tutorial":
                return lf("Start Tutorial")
            case "docs":
            default:
                return lf("Learn More")
        }
    }

    protected getCompletionActions(actions: MapCompletionAction[]) {
        const { userState, pageSourceUrl, mapId, skillMap, activity,
            dispatchOpenActivity, dispatchShowCarryoverModal } = this.props;
        const reward = activity as MapReward;
        const modalActions: ModalAction[] = [];
        actions?.forEach(el => {
            const action: Partial<ModalAction> = {
                label: el.label || this.getCompletionActionText(el),
                url: el.url
            }
            switch (el.kind) {
                case "activity":
                    const nextActivity = skillMap?.activities[el.activityId || ""];
                    if (nextActivity) {
                        action.onClick = () => {
                            tickEvent("skillmap.reward.action.activity", { path: mapId, activity: reward.activityId, nextActivityId: nextActivity.activityId });
                            this.handleOnClose();
                            if (isCodeCarryoverEnabled(userState!, pageSourceUrl!, skillMap!, nextActivity)) {
                                dispatchShowCarryoverModal(skillMap!.mapId, nextActivity.activityId);
                            } else {
                                dispatchOpenActivity(mapId, nextActivity.activityId);
                            }
                        };
                        modalActions.push(action as ModalAction);
                    }
                    break;
                case "editor":
                    const previousActivity = lookupPreviousCompletedActivityState(userState!, pageSourceUrl!, skillMap!, activity!.activityId);
                    if (previousActivity?.headerId) {
                        action.onClick = () => {
                            tickEvent("skillmap.reward.action.editor", { path: mapId, activity: reward.activityId });
                            window.open(`${editorUrl}#skillmapimport:${previousActivity.headerId}`);
                        };
                        modalActions.push(action as ModalAction);
                    }
                    break;
                case "tutorial":
                case "map":
                case "docs":
                default:
                    action.onClick = () => tickEvent(`skillmap.reward.action.${el.kind}`, { path: mapId, activity: reward.activityId, url: action.url || "" });
                    modalActions.push(action as ModalAction);
            }
        })
        return modalActions;
    }

    renderConfetti() {
        const density = 100;
        return Array(density).fill(0).map((el, i) => {
            const style = {
                animationDelay: `${0.1 * (i % density)}s`,
                left: `${1 * (Math.floor(Math.random() * density))}%`
            }
            return <div key={i} style={style} className={`confetti ${Math.random() > 0.5 ? "reverse" : ""} color-${Math.floor(Math.random() * 9)}`} />
        })
    }

    renderCompletionModal() {
        const  { skillMap, type, activity, userState, pageSourceUrl } = this.props;
        if (!type || !skillMap) return <div />

        const reward = activity as MapReward;

        const completionModalTitle = lf("You Did It!");
        const completionModalText = lf("Congratulations on completing {0}. Take some time to explore any activities you missed, or reset your progress to try again. But first, be sure to claim your reward using the button below.", "{0}");
        const completionModalTextSegments = completionModalText.split("{0}");

        const previousState = lookupPreviousCompletedActivityState(userState!, pageSourceUrl!, skillMap!, activity!.activityId);

        return <div className="confetti-container">
            <Modal title={completionModalTitle} actions={this.getCompletionActions(reward.actions)} className="completion" onClose={this.handleOnClose}>
                {completionModalTextSegments[0]}{<strong>{skillMap.displayName}</strong>}{completionModalTextSegments[1]}
                <div className="completion-reward" onClick={this.handleRewardClick}>
                    <i className="icon gift" />
                    <span>{lf("Claim your reward!")}</span>
                </div>
                {(previousState && previousState.headerId) && <div className="completion-reward" onClick={this.handleRewardShareClick}>
                    <i className="icon send" />
                    <span>{lf("Share your game!")}</span>
                </div>}
            </Modal>
            {this.renderConfetti()}
        </div>
    }

    renderRestartWarning() {
        const  { mapId, activity, dispatchRestartActivity, showCodeCarryoverModal, dispatchShowCarryoverModal } = this.props;
        const restartModalTitle = lf("Restart Activity?");
        const restartModalText = lf("Are you sure you want to restart {0}? You won't lose your path progress but the code you have written for this activity will be deleted.", "{0}");
        const restartModalTextSegments = restartModalText.split("{0}");

        const actions = [
            { label: lf("CANCEL"), onClick: this.handleOnClose },
            { label: lf("RESTART"), onClick: () => {
                tickEvent("skillmap.activity.restart", { path: mapId, activity: activity!.activityId });
                if (showCodeCarryoverModal) dispatchShowCarryoverModal(mapId, activity!.activityId);
                else dispatchRestartActivity(mapId, activity!.activityId);
            }}
        ]

        return <Modal title={restartModalTitle} actions={actions} onClose={this.handleOnClose}>
            {restartModalTextSegments[0]}{<strong>{activity!.displayName}</strong>}{restartModalTextSegments[1]}
        </Modal>
    }

    renderResetWarning() {
        const  { dispatchResetUser, dispatchHideModal } = this.props;
        const resetModalTitle = lf("Reset All Activities?");
        const resetModalText = lf("Are you sure you want to reset? This will permanently erase all progress and delete the project created for each tutorial. This action cannot be undone.");

        const actions = [
            { label: lf("CANCEL"), onClick: this.handleOnClose },
            { label: lf("RESET"), onClick: () => {
                tickEvent("skillmap.reset");
                dispatchResetUser();
                dispatchHideModal();
            }}
        ]

        return <Modal title={resetModalTitle} actions={actions} onClose={this.handleOnClose}>
            {resetModalText}
        </Modal>
    }

    renderReportAbuse() {
        const  { pageSourceUrl, dispatchHideModal } = this.props;
        const abuseModalTitle = "Report Abuse";
        const abuseModalText = "Describe the content and explain why you are reporting it for abuse. Provide as much detail as possible!";

        const actions = [
            { label: "REPORT", onClick: () => {
                tickEvent("skillmap.reportabuse");
                postAbuseReportAsync(pageSourceUrl || "", { text: (document.querySelector(".report-abuse-text") as HTMLTextAreaElement).value });
                dispatchHideModal();
            }}
        ]

        return <Modal title={abuseModalTitle} actions={actions} onClose={this.handleOnClose}>
            <textarea className="report-abuse-text" placeholder={abuseModalText} />
        </Modal>
    }

    renderCodeCarryoverModal() {
        const  { skillMap, activity, pageSourceUrl, userState, dispatchHideModal, dispatchRestartActivity } = this.props;
        const carryoverModalTitle = lf("Keep code from previous activity?");
        const carryoverModalText = lf("Do you want to start with your code from {0} or start fresh with starter code? Your images, tilemaps, tiles, and animations will stick around either way.");
        const carryoverModalTextSegments = carryoverModalText.split("{0}");

        const previousState = lookupPreviousCompletedActivityState(userState!, pageSourceUrl!, skillMap!, activity!.activityId);
        const previous = skillMap!.activities[previousState?.activityId];

        if (!previous) return <div />

        const actions = [
            { label: lf("START FRESH"), onClick: async () => {
                tickEvent("skillmap.startfresh", { path: skillMap!.mapId, activity: activity!.activityId, previousActivity: previous.activityId });

                dispatchRestartActivity(skillMap!.mapId, activity!.activityId, previousState.headerId, false);
                dispatchHideModal();
            } },
            { label: lf("KEEP CODE"), onClick: async () => {
                tickEvent("skillmap.keepcode", { path: skillMap!.mapId, activity: activity!.activityId, previousActivity: previous.activityId });

                dispatchRestartActivity(skillMap!.mapId, activity!.activityId, previousState.headerId, true);
                dispatchHideModal();
            } }
        ]

        return <Modal title={carryoverModalTitle} actions={actions} onClose={this.handleOnClose}>
            {carryoverModalTextSegments[0]}{<strong>{previous!.displayName}</strong>}{carryoverModalTextSegments[1]}
        </Modal>
    }

    protected handleShareInputClick = (evt: any) => { evt.target.select() }
    protected handleShareCopyClick = () => {
        const { mapId, activity } = this.props;
        tickEvent("skillmap.share.copy", { path: mapId, activity: activity!.activityId });
        const input = document.querySelector(".share-input input") as HTMLInputElement;
        if (input) {
            input.select();
            document.execCommand("copy");
        }
    }

    renderShareModal() {
        const { userState, pageSourceUrl, mapId, activity, shareState, dispatchSetShareStatus } = this.props;
        const { loading } = this.state;

        const shortId = shareState?.url;

        const resetModalTitle = shortId ? lf("Share Project") : lf("Publish Project");

        const actions = [];
        if (!shortId) {
            actions.push({ label: lf("Cancel"), onClick: this.handleOnClose });
            actions.push({ label: lf("Publish"), onClick: async () => {
                tickEvent("skillmap.share", { path: mapId, activity: activity!.activityId });
                this.setState({ loading: true });

                const progress = lookupActivityProgress(userState!, pageSourceUrl!, mapId!, activity!.activityId);

                dispatchSetShareStatus(progress?.headerId);
            }});
        }

        return <Modal title={resetModalTitle} actions={actions} onClose={this.handleOnClose}>
            {shortId ?
                <div>{ lf("Your project is ready! Use the address below to share your projects.") }</div> :
                <div className="share-disclaimer">
                    { lf("You need to publish your project to share it or embed it in other web pages. You acknowledge having consent to publish this project.") }
                </div>
            }
            {(loading && !shortId) && <div className="share-loader">
                <div className="ui active inline loader" />
                <span>{lf("Loading...")}</span>
            </div>}
            {shortId && <div className="share-input">
                <input type="text" readOnly={true} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                    value={`https://makecode.com/${shortId}`} onClick={this.handleShareInputClick}></input>
                <div className="share-copy" onClick={this.handleShareCopyClick} role="button">
                    <i className="icon copy" />
                    {lf("Copy")}
                </div>
            </div>}
            {(shortId && shareState?.rewardsShare) && <div>
                {this.renderConfetti()}
            </div>}
        </Modal>
    }

    renderLoginModal(activityPrompt: boolean) {
        const rememberMeSelected = this.state.checkboxSelected ?? false;

        return <Modal className={`sign-in ${activityPrompt ? "wide" : ""}`} title={activityPrompt ? lf("Save your Completed Activity") : lf("Sign into {0}", pxt.appTarget.appTheme.organizationText)} onClose={this.handleOnClose}>
            <div className="container">
                {activityPrompt ? <div className="image"> <img src={resolvePath("/assets/cloud-user.svg")} alt={lf("Sign in icon")} className="icon cloud-user"/></div> : null}
                <div className="description">
                    <div className="paragraph">{lf("Sign in and we'll save your projects to the cloud, where they're accessible from anywhere.")}</div>
                    <div className="paragraph create-account-hint">{lf("Don't have an account? Start signing in to create one!")}</div>
                    <div className="paragraph">{lf("Sign in with")}</div>
                    {pxt.auth.identityProviders().map(provider => <div key={provider.id} className="paragraph"><div className="modal-button" onClick={async () => await this.handleSigninClick(provider)} role="button">
                        <span className={`xicon ${provider.id}`} /> <span>{provider.name}</span>
                    </div></div>)}
                    <div className="paragraph"><div className="remember" onClick={() => this.handleRememberMeClick()}>
                        <i className={`icon square outline ${rememberMeSelected ? "check" : ""}`} />
                        {lf("Remember me")}
                    </div></div>
                </div>
            </div>
        </Modal>
    }

    async handleSigninClick(provider: pxt.AppCloudProvider) {
        const rememberMeSelected = this.state.checkboxSelected ?? false;
        pxt.tickEvent(`skillmap.signindialog.signin`, { provider: provider.id, rememberMe: rememberMeSelected.toString() });
        await pxt.auth.client().loginAsync(provider.id, rememberMeSelected, { hash: location.hash });
    }

    handleRememberMeClick() {
        const rememberMeSelected = this.state.checkboxSelected ?? false;
        const rememberMe = !rememberMeSelected;
        tickEvent("skillmap.signindialog.rememberme", { rememberMe: rememberMe.toString() });
        this.setState({ checkboxSelected: rememberMe });
    }

    renderDeleteAccountModal() {
        const { checkboxSelected } = this.state;

        const buttons = [];
        buttons.push({
            label: lf("Confirm"),
            className: checkboxSelected ? "confirm" : "confirm disabled",

            onClick: async () => {
                if (checkboxSelected) {
                    tickEvent("skillmap.profile.delete");
                    this.props.dispatchHideModal();
                    this.props.dispatchCloseUserProfile();
                    await pxt.auth.client().deleteProfileAsync();
                    location.reload();
                }
            }
        })

        buttons.push({
            label: lf("Back to safety"),
            className: "disagree",
            onClick: this.props.dispatchHideModal
        })

        return <Modal title={lf("Delete Profile")} className="delete" actions={buttons} onClose={this.handleOnClose}>
            <div> { lf("Are you sure? This cannot be reversed! Your cloud-saved projects will be converted to local projects on this device.") }
            </div>
            <div className="confirm-delete checkbox" onClick={() => {
                    this.setState({ checkboxSelected: !checkboxSelected });
                }}>
                <i className={`icon square outline ${checkboxSelected ? "check" : ""}`} />
                { lf("I understand this is permanent. No undo.") }
            </div>
        </Modal>
    }
}

function mapStateToProps(state: SkillMapState, ownProps: any) {
    if (!state) return {};
    const { pageSourceUrl, shareState } = state;
    const { currentMapId, currentActivityId, type } = state.modal || {};

    // Set the map as currently open map (editorView), or mapId passed into modal
    const currentMap = state.editorView ?
        state.maps[state.editorView.currentMapId] :
        (currentMapId && state.maps[currentMapId]);
    const activity = (currentMapId && currentActivityId) ? state.maps[currentMapId]?.activities[currentActivityId] : undefined

    return {
        type,
        pageSourceUrl,
        skillMap: currentMap,
        userState: state.user,
        showCodeCarryoverModal: currentMap && activity && isCodeCarryoverEnabled(state.user, state.pageSourceUrl, currentMap, activity),
        mapId: currentMapId,
        activity: currentMapId && currentActivityId ? state.maps[currentMapId].activities[currentActivityId] : undefined,
        shareState
    }
}

const mapDispatchToProps = {
    dispatchHideModal,
    dispatchRestartActivity,
    dispatchOpenActivity,
    dispatchResetUser,
    dispatchShowCarryoverModal,
    dispatchCloseUserProfile,
    dispatchSetShareStatus,
    dispatchShowShareModal
};

export const AppModal = connect(mapStateToProps, mapDispatchToProps)(AppModalImpl);
