import React from 'react';
import { contact } from '../content/contact';
import { ExternalLink, Hint } from '../components/ui';
import { EnvelopeIcon, LinkIcon } from '../icons';
import { safeUrl } from '../util';

const ContactApp: React.FC = () => {
    const email = contact.email
        ? `${contact.email.user}@${contact.email.domain}`
        : null;

    return (
        <div className="dsk-pane">
            {contact.note && <p className="dsk-lead">{contact.note}</p>}

            <ul className="dsk-contact-list">
                {email && (
                    <li>
                        <EnvelopeIcon size={20} />
                        <span className="dsk-contact-label">Email</span>
                        <a href={`mailto:${email}`}>{email}</a>
                    </li>
                )}
                {contact.links.map((link) => {
                    const href = safeUrl(link.url);
                    return (
                        <li key={link.label}>
                            <LinkIcon size={20} />
                            <span className="dsk-contact-label">{link.label}</span>
                            {href ? (
                                <ExternalLink href={href}>
                                    {link.handle || link.url}
                                </ExternalLink>
                            ) : (
                                <Hint>Add the URL in src/desktop/content/contact.ts</Hint>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default ContactApp;
