import { apiService as api } from 'src/store/apiService';

export const marketingTagTypes = ['newsletterSubscribers', 'newsletterCampaigns', 'contactRequests', 'siteChats'] as const;

export type NewsletterSubscriber = {
	id: string;
	email: string;
	status: string;
	source: string | null;
	subscribed_at: string | null;
	unsubscribed_at: string | null;
	created_at: string;
};

export type NewsletterCampaign = {
	id: string;
	subject: string;
	body_html: string | null;
	body_text: string | null;
	status: string;
	sent_at: string | null;
	sent_by: string | null;
	recipient_count: number;
	created_at: string;
	updated_at: string;
	sent_by_first_name?: string | null;
	sent_by_last_name?: string | null;
};

export type NewsletterCampaignRecipient = {
	id: string;
	email: string;
	status: string;
	sent_at: string | null;
	error_message: string | null;
};

export type ContactRequestRow = {
	id: string;
	name: string;
	email: string;
	message: string;
	status: string;
	admin_notes: string | null;
	replied_at: string | null;
	created_at: string;
};

export type ContactRequestReply = {
	id: string;
	message: string;
	is_staff: boolean;
	created_at: string;
	first_name?: string | null;
	last_name?: string | null;
};

export type SiteChatSessionRow = {
	id: string;
	name: string;
	email: string;
	status: string;
	source: string | null;
	last_message_at: string | null;
	created_at: string;
	last_message_preview?: string | null;
	message_count?: number;
};

export type SiteChatMessage = {
	id: string;
	body: string;
	sender_type: string;
	is_staff: boolean;
	created_at: string;
	staff_name?: string | null;
};

export type SiteChatSessionDetail = SiteChatSessionRow & {
	admin_notes?: string | null;
	replied_at?: string | null;
};

const MarketingApi = api
	.enhanceEndpoints({ addTagTypes: marketingTagTypes })
	.injectEndpoints({
		endpoints: (build) => ({
			getNewsletterSubscribers: build.query<{ subscribers: NewsletterSubscriber[] }, { q?: string; status?: string } | void>({
				query: (arg) => ({
					url: '/api/newsletter/subscribers',
					params: arg && typeof arg === 'object' ? arg : undefined
				}),
				providesTags: ['newsletterSubscribers']
			}),
			updateNewsletterSubscriber: build.mutation<{ subscriber: NewsletterSubscriber }, { id: string; status: string }>({
				query: ({ id, status }) => ({
					url: `/api/newsletter/subscribers/${id}`,
					method: 'PATCH',
					body: { status }
				}),
				invalidatesTags: ['newsletterSubscribers']
			}),
			getNewsletterCampaigns: build.query<{ campaigns: NewsletterCampaign[] }, { status?: string } | void>({
				query: (arg) => ({
					url: '/api/newsletter/campaigns',
					params: arg && typeof arg === 'object' ? arg : undefined
				}),
				providesTags: ['newsletterCampaigns']
			}),
			getNewsletterCampaign: build.query<
				{ campaign: NewsletterCampaign; recipients: NewsletterCampaignRecipient[] },
				string
			>({
				query: (id) => ({ url: `/api/newsletter/campaigns/${id}` }),
				providesTags: ['newsletterCampaigns']
			}),
			createNewsletterCampaign: build.mutation<
				{ campaign: NewsletterCampaign },
				{ subject: string; body_html?: string; body_text?: string }
			>({
				query: (body) => ({
					url: '/api/newsletter/campaigns',
					method: 'POST',
					body
				}),
				invalidatesTags: ['newsletterCampaigns']
			}),
			updateNewsletterCampaign: build.mutation<
				{ campaign: NewsletterCampaign },
				{ id: string; subject?: string; body_html?: string; body_text?: string }
			>({
				query: ({ id, ...body }) => ({
					url: `/api/newsletter/campaigns/${id}`,
					method: 'PUT',
					body
				}),
				invalidatesTags: ['newsletterCampaigns']
			}),
			sendNewsletterCampaign: build.mutation<
				{ campaign: NewsletterCampaign; sentCount: number; totalSubscribers: number },
				string
			>({
				query: (id) => ({
					url: `/api/newsletter/campaigns/${id}/send`,
					method: 'POST'
				}),
				invalidatesTags: ['newsletterCampaigns', 'newsletterSubscribers']
			}),
			getContactRequests: build.query<{ requests: ContactRequestRow[] }, { q?: string; status?: string } | void>({
				query: (arg) => ({
					url: '/api/contact-requests',
					params: arg && typeof arg === 'object' ? arg : undefined
				}),
				providesTags: ['contactRequests']
			}),
			getContactRequest: build.query<
				{ request: ContactRequestRow; replies: ContactRequestReply[] },
				string
			>({
				query: (id) => ({ url: `/api/contact-requests/${id}` }),
				providesTags: ['contactRequests']
			}),
			updateContactRequest: build.mutation<
				{ request: ContactRequestRow },
				{ id: string; status?: string; admin_notes?: string }
			>({
				query: ({ id, ...body }) => ({
					url: `/api/contact-requests/${id}`,
					method: 'PATCH',
					body
				}),
				invalidatesTags: ['contactRequests']
			}),
			replyToContactRequest: build.mutation<
				{ request: ContactRequestRow; replies: ContactRequestReply[] },
				{ id: string; message: string }
			>({
				query: ({ id, message }) => ({
					url: `/api/contact-requests/${id}/reply`,
					method: 'POST',
					body: { message }
				}),
				invalidatesTags: ['contactRequests']
			}),
			getSiteChats: build.query<{ sessions: SiteChatSessionRow[] }, { q?: string; status?: string } | void>({
				query: (arg) => ({
					url: '/api/site-chats',
					params: arg && typeof arg === 'object' ? arg : undefined
				}),
				providesTags: ['siteChats']
			}),
			getSiteChat: build.query<{ session: SiteChatSessionDetail; messages: SiteChatMessage[] }, string>({
				query: (id) => ({ url: `/api/site-chats/${id}` }),
				providesTags: ['siteChats']
			}),
			updateSiteChat: build.mutation<
				{ session: SiteChatSessionDetail },
				{ id: string; status?: string; admin_notes?: string }
			>({
				query: ({ id, ...body }) => ({
					url: `/api/site-chats/${id}`,
					method: 'PATCH',
					body
				}),
				invalidatesTags: ['siteChats']
			}),
			replyToSiteChat: build.mutation<
				{ session: SiteChatSessionDetail; messages: SiteChatMessage[] },
				{ id: string; message: string }
			>({
				query: ({ id, message }) => ({
					url: `/api/site-chats/${id}/reply`,
					method: 'POST',
					body: { message }
				}),
				invalidatesTags: ['siteChats']
			})
		}),
		overrideExisting: false
	});

export default MarketingApi;

export const {
	useGetNewsletterSubscribersQuery,
	useUpdateNewsletterSubscriberMutation,
	useGetNewsletterCampaignsQuery,
	useGetNewsletterCampaignQuery,
	useLazyGetNewsletterCampaignQuery,
	useCreateNewsletterCampaignMutation,
	useUpdateNewsletterCampaignMutation,
	useSendNewsletterCampaignMutation,
	useGetContactRequestsQuery,
	useGetContactRequestQuery,
	useLazyGetContactRequestQuery,
	useUpdateContactRequestMutation,
	useReplyToContactRequestMutation,
	useGetSiteChatsQuery,
	useGetSiteChatQuery,
	useUpdateSiteChatMutation,
	useReplyToSiteChatMutation
} = MarketingApi;
