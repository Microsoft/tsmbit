import * as React from "react";
import { classList, ControlProps, fireClickOnEnter } from "../util";

export interface ButtonProps extends ControlProps {
    onClick: () => void;
    onKeydown?: (e: React.KeyboardEvent) => void;
    buttonRef?: (ref: HTMLButtonElement) => void;
    title: string;
    label?: string | JSX.Element;
    leftIcon?: string;
    rightIcon?: string;
    disabled?: boolean;
    href?: string;
    target?: string;

    /** Miscellaneous aria pass-through props */
    ariaControls?: string;
    ariaExpanded?: boolean;
    ariaHasPopup?: string;
    ariaPosInSet?: number;
    ariaSetSize?: number;
}

export const Button = (props: ButtonProps) => {
    const {
        id,
        className,
        ariaLabel,
        ariaHidden,
        ariaControls,
        ariaExpanded,
        ariaHasPopup,
        ariaPosInSet,
        ariaSetSize,
        role,
        onClick,
        onKeydown,
        buttonRef,
        title,
        label,
        leftIcon,
        rightIcon,
        disabled,
        href,
        target
    } = props;

    const classes = classList(
        "common-button",
        className,
        disabled && "disabled"
    );

    let clickHandler = () => {
        if (onClick) onClick();
        if (href) window.open(href, target || "_blank", "noopener,noreferrer")
    }

    return (
        <button
            id={id}
            className={classes}
            title={title}
            ref={buttonRef}
            onClick={!disabled ? clickHandler : undefined}
            onKeyDown={onKeydown || fireClickOnEnter}
            role={role || "button"}
            tabIndex={disabled ? -1 : 0}
            aria-label={ariaLabel}
            aria-hidden={ariaHidden}
            aria-controls={ariaControls}
            aria-expanded={ariaExpanded}
            aria-haspopup={ariaHasPopup as any}
            aria-posinset={ariaPosInSet}
            aria-setsize={ariaSetSize}>
                <span className="common-button-flex">
                    {leftIcon && <i className={leftIcon} aria-hidden={true}/>}
                    <span className="common-button-label">
                        {label}
                    </span>
                    {rightIcon && <i className={"right " + rightIcon} aria-hidden={true}/>}
                </span>
        </button>
    );
}