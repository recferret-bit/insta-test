/**
 * SSE ticket exchange — external-communication/02-auth-and-users-api.md (`POST /events/ticket`) and
 * internal-communication/02-domain-events-and-sse.md#ticket-exchange-dec-08. `EventSource` cannot send
 * headers, so the bearer token is exchanged for a 60-second one-time ticket passed in the query string.
 */
import { SseTicketResponseDto } from "@insta/contracts";

import { buildUrl, request } from "./http";

/** `POST /events/ticket` → `201 SseTicketResponseDto`. */
export function createEventTicket(signal?: AbortSignal): Promise<SseTicketResponseDto> {
  return request("POST", "/events/ticket", { schema: SseTicketResponseDto, signal });
}

/** `{apiUrl}/api/v1/events/stream?ticket=<ticket>` for `new EventSource(url)`. */
export function eventStreamUrl(ticket: string): string {
  return buildUrl("/events/stream", { ticket });
}
