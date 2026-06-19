import { FactCheck, Source } from "./types";

export class FactCheckDbClient {
  private static readonly API_URL =
    "https://factchecktools.googleapis.com/v1alpha1/claims:search";

  constructor(private readonly apiKey: string) {}

  async getFactChecks(claim: string): Promise<FactCheck[]> {
    const response = await this.sendRequestToFactCheckApi(claim);
    return this.extractFactChecksFromApiResponse(response);
  }

  private async sendRequestToFactCheckApi(
    claim: string,
  ): Promise<Record<string, unknown>> {
    const params = new URLSearchParams({
      query: claim,
      key: this.apiKey,
    });

    const response = await fetch(`${FactCheckDbClient.API_URL}?${params}`);

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private extractFactChecksFromApiResponse(
    response: Record<string, unknown>,
  ): FactCheck[] {
    const claims = (response.claims as Record<string, unknown>[]) ?? [];

    return claims.reduce<FactCheck[]>((factChecks, claim) => {
      const claimReview =
        (claim.claimReview as Record<string, unknown>[]) ?? [];
      if (!claimReview.length) return factChecks;

      factChecks.push({
        claimText: (claim.text as string) ?? "",
        factCheckDate: (claim.claimDate as string) ?? "",
        source: this.parseSource(claimReview[0]),
      });

      return factChecks;
    }, []);
  }

  private parseSource(source: Record<string, unknown>): Source {
    const publisher = (source.publisher as Record<string, string>) ?? {};

    return {
      publisherName: publisher.name ?? "",
      publisherSite: publisher.site ?? "",
      url: (source.url as string) ?? "",
      articleTitle: (source.title as string) ?? "",
      rating: (source.textualRating as string) ?? "",
    };
  }
}
