/**
 * Strapi v5 Database Migration: Backfill slugs for existing events
 *
 * This migration generates unique slugs for all events that don't have one yet.
 * It uses the same slug generation logic as the event service lifecycle hooks.
 *
 * Note: This migration is idempotent - it can be run multiple times safely.
 * It only processes events that don't have a slug.
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

    // Exclude current event when processing
    if (excludeDocumentId) {
      filters.documentId = { $ne: excludeDocumentId };
    }

    const existingEvents = await strapi.entityService.findMany(
      "api::event.event",
      {
        filters,
        limit: 1,
      },
    );

    if (!existingEvents || existingEvents.length === 0) {
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
  strapi.log.info("Starting event slug backfill migration...");

  try {
    // Ensure table exists before querying columns
    const hasTable = await strapi.db.connection.schema.hasTable("events");
    if (!hasTable) {
      strapi.log.info("Events table does not exist yet. Skipping slug backfill.");
      return;
    }

    // Ensure slug column exists before querying
    const hasSlugColumn = await strapi.db.connection.schema.hasColumn(
      "events",
      "slug",
    );
    if (!hasSlugColumn) {
      strapi.log.info("Adding slug column to events table...");
      await strapi.db.connection.schema.alterTable("events", (table) => {
        table.string("slug").unique().nullable();
      });
    }

    // Get all events without slugs
    const eventsWithoutSlugs = await strapi.db
      .query("api::event.event")
      .findMany({
        where: {
          $or: [{ slug: null }, { slug: "" }],
        },
      });

    if (!eventsWithoutSlugs || eventsWithoutSlugs.length === 0) {
      strapi.log.info(
        "✓ No events need slug generation. All events already have slugs.",
      );
      return;
    }

    strapi.log.info(`Found ${eventsWithoutSlugs.length} events without slugs.`);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Process each event
    for (const event of eventsWithoutSlugs) {
      try {
        if (!event.title) {
          strapi.log.warn(`⚠ Skipping event ${event.documentId}: No title`);
          errorCount++;
          errors.push({
            documentId: event.documentId,
            error: "No title provided",
          });
          continue;
        }

        // Generate unique slug
        const slug = await generateUniqueSlug(event.title, event.documentId);

        // Update event with slug using database query
        await strapi.db.query("api::event.event").update({
          where: { documentId: event.documentId },
          data: { slug },
        });

        strapi.log.info(`✓ Event "${event.title}" → slug: "${slug}"`);
        successCount++;
      } catch (error) {
        strapi.log.error(
          `✗ Error processing event ${event.documentId}: ${error.message}`,
        );
        errorCount++;
        errors.push({
          documentId: event.documentId,
          title: event.title,
          error: error.message,
        });
      }
    }

    // Summary
    strapi.log.info("=".repeat(60));
    strapi.log.info("Migration Summary:");
    strapi.log.info("=".repeat(60));
    strapi.log.info(`Total events processed: ${eventsWithoutSlugs.length}`);
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
 * Note: This removes all slugs from events. Use with caution!
 */
async function down() {
  strapi.log.info("Reverting event slug backfill migration...");

  try {
    // Get all events with slugs
    const eventsWithSlugs = await strapi.db.query("api::event.event").findMany({
      where: {
        slug: { $ne: null },
      },
    });

    if (!eventsWithSlugs || eventsWithSlugs.length === 0) {
      strapi.log.info("✓ No events have slugs to remove.");
      return;
    }

    strapi.log.info(
      `Found ${eventsWithSlugs.length} events with slugs to remove.`,
    );

    // Remove slugs from all events
    for (const event of eventsWithSlugs) {
      await strapi.db.query("api::event.event").update({
        where: { documentId: event.documentId },
        data: { slug: null },
      });

      strapi.log.info(`✓ Removed slug from event: "${event.title}"`);
    }

    strapi.log.info("✓ Migration reverted!");
  } catch (error) {
    strapi.log.error("✗ Migration revert failed:", error);
    throw error;
  }
}

module.exports = { up, down };
