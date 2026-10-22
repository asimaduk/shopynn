-- Marketing-site tables existed only in alt.sql, so databases built from schema.sql never got them
-- ("relation contact_requests does not exist" on POST /api/public/contact).

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id varchar(40) primary key,
    email varchar(255) not null,
    status varchar(20) not null default 'active',
    source varchar(100),
    subscribed_at timestamp not null default now(),
    unsubscribed_at timestamp,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);
CREATE UNIQUE INDEX IF NOT EXISTS index_newsletter_subscribers_email_lower ON newsletter_subscribers (lower(email));

CREATE TABLE IF NOT EXISTS newsletter_campaigns (
    id varchar(40) primary key,
    subject varchar(500) not null,
    body_html text,
    body_text text,
    status varchar(20) not null default 'draft',
    sent_at timestamp,
    sent_by varchar(40) references users(id),
    recipient_count int not null default 0,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);
CREATE INDEX IF NOT EXISTS index_newsletter_campaigns_status_sent ON newsletter_campaigns(status, sent_at desc nulls last);

CREATE TABLE IF NOT EXISTS newsletter_campaign_recipients (
    id varchar(40) primary key,
    campaign_id varchar(40) not null references newsletter_campaigns(id) on delete cascade,
    subscriber_id varchar(40) references newsletter_subscribers(id) on delete set null,
    email varchar(255) not null,
    status varchar(20) not null default 'pending',
    sent_at timestamp,
    error_message varchar(500),
    created_at timestamp not null default now()
);
CREATE INDEX IF NOT EXISTS index_newsletter_campaign_recipients_campaign ON newsletter_campaign_recipients(campaign_id);

CREATE TABLE IF NOT EXISTS contact_requests (
    id varchar(40) primary key,
    name varchar(200) not null,
    email varchar(255) not null,
    message text not null,
    status varchar(20) not null default 'open',
    admin_notes text,
    replied_at timestamp,
    replied_by varchar(40) references users(id),
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);
CREATE INDEX IF NOT EXISTS index_contact_requests_status_created ON contact_requests(status, created_at desc);

CREATE TABLE IF NOT EXISTS contact_request_replies (
    id varchar(40) primary key,
    request_id varchar(40) not null references contact_requests(id) on delete cascade,
    message text not null,
    is_staff boolean not null default true,
    created_by varchar(40) references users(id),
    created_at timestamp not null default now()
);
CREATE INDEX IF NOT EXISTS index_contact_request_replies_request ON contact_request_replies(request_id, created_at);

CREATE TABLE IF NOT EXISTS site_chat_sessions (
    id varchar(40) primary key,
    visitor_token varchar(40) not null unique,
    name varchar(200) not null,
    email varchar(255) not null,
    status varchar(20) not null default 'open',
    source varchar(100),
    admin_notes text,
    replied_at timestamp,
    replied_by varchar(40) references users(id),
    last_message_at timestamp,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now()
);
CREATE INDEX IF NOT EXISTS index_site_chat_sessions_status_last ON site_chat_sessions(status, last_message_at desc nulls last);

CREATE TABLE IF NOT EXISTS site_chat_messages (
    id varchar(40) primary key,
    session_id varchar(40) not null references site_chat_sessions(id) on delete cascade,
    body text not null,
    sender_type varchar(20) not null,
    created_by varchar(40) references users(id),
    created_at timestamp not null default now()
);
CREATE INDEX IF NOT EXISTS index_site_chat_messages_session ON site_chat_messages(session_id, created_at);
