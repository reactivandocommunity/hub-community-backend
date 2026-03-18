/**
 * Strapi v5 Database Migration: Backfill slugs for existing communities
 *
 * This migration generates unique slugs for all communities that don't have one yet.
 * It uses the same slug generation logic as the community service lifecycle hooks.
 *
 * Note: This migration is idempotent - it can be run multiple times safely.
 * It only processes communities that don't have a slug.
 */

const slugify = require("slugify");

const MAX_SLUG_LENGTH = 100;

/**
 * Generates a unique slug from the title
 */
async function generateUniqueSlug(title, excludeDocumentId = null) {
  if (!title || typeof title !== "string") {
    throw new Error("Title is required to generate slug");
  }

  // Generate base slug from title
  let baseSlug = slugify(title, {
    lower: true,
    strict: true,
    trim: true,
  });

  // Truncate to max length
  if (baseSlug.length > MAX_SLUG_LENGTH) {
    baseSlug = baseSlug.substring(0, MAX_SLUG_LENGTH);
    // Remove trailing hyphen if truncation caused it
    baseSlug = baseSlug.replace(/-+$/, "");
  }

  let slug = baseSlug;
  let counter = 2;

  // Check for uniqueness and add suffix if needed
  while (true) {
    const filters = { slug: { $eq: slug } };

    // Exclude current community when processing
    if (excludeDocumentId) {
      filters.documentId = { $ne: excludeDocumentId };
    }

    const existingCommunities = await strapi.entityService.findMany(
      "api::community.community",
      {
        filters,
        limit: 1,
      },
    );

    if (!existingCommunities || existingCommunities.length === 0) {
      break;
    }

    // Slug exists, try with counter suffix
    const suffix = `-${counter}`;
    const maxBaseLength = MAX_SLUG_LENGTH - suffix.length;
    slug = `${baseSlug.substring(0, maxBaseLength)}${suffix}`;
    counter++;
  }

  return slug;
}

/**
 * Migration UP: Apply changes
 */
async function up() {
  strapi.log.info("Starting community slug backfill migration...");

  try {
    // Ensure table exists before querying columns
    const hasTable = await strapi.db.connection.schema.hasTable("communities");
    if (!hasTable) {
      strapi.log.info("Communities table does not exist yet. Skipping slug backfill.");
      return;
    }

    // Ensure slug column exists before querying
    const hasSlugColumn = await strapi.db.connection.schema.hasColumn(
      "communities",
      "slug",
    );
    if (!hasSlugColumn) {
      strapi.log.info("Adding slug column to communities table...");
      await strapi.db.connection.schema.alterTable("communities", (table) => {
        table.string("slug").unique().nullable();
      });
    }

    // Get all communities without slugs
    const communitiesWithoutSlugs = await strapi.db
      .query("api::community.community")
      .findMany({
        where: {
          $or: [{ slug: null }, { slug: "" }],
        },
      });

    if (!communitiesWithoutSlugs || communitiesWithoutSlugs.length === 0) {
      strapi.log.info(
        "✓ No communities need slug generation. All communities already have slugs.",
      );
      return;
    }

    strapi.log.info(
      `Found ${communitiesWithoutSlugs.length} communities without slugs.`,
    );

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process each community
    for (const community of communitiesWithoutSlugs) {
      try {
        if (!community.title) {
          strapi.log.warn(
            `⚠ Skipping community ${community.documentId}: No title`,
          );
          errorCount++;
          errors.push({
            documentId: community.documentId,
            error: "No title provided",
          });
          continue;
        }

        // Generate unique slug
        const slug = await generateUniqueSlug(
          community.title,
          community.documentId,
        );

        // Update community with slug using database query
        await strapi.db.query("api::community.community").update({
          where: { documentId: community.documentId },
          data: { slug },
        });

        strapi.log.info(`✓ Community "${community.title}" → slug: "${slug}"`);
        successCount++;
      } catch (error) {
        strapi.log.error(
          `✗ Error processing community ${community.documentId}: ${error.message}`,
        );
        errorCount++;
        errors.push({
          documentId: community.documentId,
          title: community.title,
          error: error.message,
        });
      }
    }

    // Summary
    strapi.log.info("=".repeat(60));
    strapi.log.info("Migration Summary:");
    strapi.log.info("=".repeat(60));
    strapi.log.info(
      `Total communities processed: ${communitiesWithoutSlugs.length}`,
    );
    strapi.log.info(`✓ Successfully updated: ${successCount}`);
    strapi.log.info(`✗ Errors: ${errorCount}`);

    if (errors.length > 0) {
      strapi.log.warn("\nErrors:");
      errors.forEach((err) => {
        strapi.log.warn(
          `  - ${err.documentId} (${err.title || "no title"}): ${err.error}`,
        );
      });
    }

    strapi.log.info("✓ Migration completed!");
  } catch (error) {
    strapi.log.error("✗ Migration failed:", error);
    throw error;
  }
}

/**
 * Migration DOWN: Revert changes
 *
 * Note: This removes all slugs from communities. Use with caution!
 */
async function down() {
  strapi.log.info("Reverting community slug backfill migration...");

  try {
    // Get all communities with slugs
    const communitiesWithSlugs = await strapi.db
      .query("api::community.community")
      .findMany({
        where: {
          slug: { $ne: null },
        },
      });

    if (!communitiesWithSlugs || communitiesWithSlugs.length === 0) {
      strapi.log.info("✓ No communities have slugs to remove.");
      return;
    }

    strapi.log.info(
      `Found ${communitiesWithSlugs.length} communities with slugs to remove.`,
    );

    // Remove slugs from all communities
    for (const community of communitiesWithSlugs) {
      await strapi.db.query("api::community.community").update({
        where: { documentId: community.documentId },
        data: { slug: null },
      });

      strapi.log.info(`✓ Removed slug from community: "${community.title}"`);
    }

    strapi.log.info("✓ Migration reverted!");
  } catch (error) {
    strapi.log.error("✗ Migration revert failed:", error);
    throw error;
  }
}

module.exports = { up, down };
