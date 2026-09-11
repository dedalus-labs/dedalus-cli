// @custom start
// Generate public OAuth metadata from the resource API's published contract.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const PUBLIC_ORIGIN = "https://dcs.dedaluslabs.ai";
const PUBLIC_URL_SCHEMA = z.url().refine((value) => {
	const url = new URL(value);
	return url.origin === PUBLIC_ORIGIN && !url.username && !url.password && !url.search && !url.hash;
});
const OAUTH_SCHEMA = z.object({
	type: z.literal("oauth2"),
	flows: z.object({
		authorizationCode: z.object({
			authorizationUrl: PUBLIC_URL_SCHEMA,
			tokenUrl: PUBLIC_URL_SCHEMA,
			refreshUrl: PUBLIC_URL_SCHEMA,
			scopes: z.record(z.string(), z.string()),
		}),
	}),
	"x-issuer": z.literal(PUBLIC_ORIGIN),
	"x-userinfo-url": PUBLIC_URL_SCHEMA,
	"x-revocation-url": PUBLIC_URL_SCHEMA,
	"x-client-id": z.string().min(1),
});
const DOCUMENT_SCHEMA = z.object({
	servers: z.tuple([z.object({ url: z.literal(PUBLIC_ORIGIN) })]),
	components: z.object({ securitySchemes: z.object({ cliOAuth: OAUTH_SCHEMA }) }),
});

/** Render only validated public fields, without source paths or private metadata. */
export function generateAuthMetadata(document: unknown): string {
	// OpenAPI JSON is an external document. Parse the exact fields consumed here.
	const parsed = DOCUMENT_SCHEMA.safeParse(document);
	if (!parsed.success) throw new Error("OpenAPI public OAuth contract is invalid");
	const oauth = parsed.data.components.securitySchemes.cliOAuth;
	const flow = oauth.flows.authorizationCode;
	if (flow.refreshUrl !== flow.tokenUrl)
		throw new Error("OAuth refresh and token endpoints must agree");
	const metadata = {
		resource: parsed.data.servers[0].url,
		issuer: oauth["x-issuer"],
		authorizationURL: flow.authorizationUrl,
		tokenURL: flow.tokenUrl,
		userInfoURL: oauth["x-userinfo-url"],
		revocationURL: oauth["x-revocation-url"],
		clientId: oauth["x-client-id"],
		scopes: Object.keys(flow.scopes).sort(),
	};
	return (
		"// Generated from the public OpenAPI OAuth contract. Do not edit.\n" +
		"/** Approved public authorization endpoints and client identity. */\n" +
		`export const PUBLIC_AUTH = ${JSON.stringify(metadata, null, "\t")} as const;\n`
	);
}

const invoked = process.argv[1];
if (invoked && resolve(invoked) === fileURLToPath(import.meta.url)) {
	const input = process.argv[2];
	const output = process.argv[3];
	if (!input || !output) throw new Error("expected OpenAPI JSON path and output TypeScript path");
	writeFileSync(output, generateAuthMetadata(JSON.parse(readFileSync(input, "utf8"))));
}
// @custom end
