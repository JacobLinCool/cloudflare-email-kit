export type EmailQueueMessage = {
	message_id: string;
	from: string;
	to: string;
	headers: [key: string, value: string][];
	size: number;
};
