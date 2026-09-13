export type FacetCount = { value: string; label: string; count: number };

export type Facets = {
  brands: FacetCount[];
  widths: FacetCount[];
  profiles: FacetCount[];
  rims: FacetCount[];
  vehicleTypes: FacetCount[];
};

export type CatalogFilters = {
  query?: string;
  brandSlugs?: string[];
  widths?: number[];
  profiles?: number[];
  rims?: number[];
  vehicleTypes?: string[];
  minPriceCents?: number;
  maxPriceCents?: number;
  page: number;
  perPage: number;
};

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  imageUrl: string | null;
  altText: string | null;
  fromPriceCents: number;
  sizes: string[];
};

export type VariantDetail = {
  id: string;
  sku: string;
  priceCents: number;
  sizeLabel: string | null;
  vehicleType: string | null;
  /** Unidades que o cliente pode comprar agora. Zero é esgotado. */
  disponivel: number;
};

export type ProductDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  brandName: string;
  media: { url: string; alt: string }[];
  variants: VariantDetail[];
};

export type SearchResult = {
  items: ProductSummary[];
  total: number;
  facets: Facets;
};
