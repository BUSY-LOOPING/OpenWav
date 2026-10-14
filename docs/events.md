# Event tracking

## Event tracking

The client batches `play_start`, `play_progress`, `play_complete`, `skip`, `like`, `unlike`, `search`, `add_to_playlist`, `remove_from_playlist`, `download_request` and `page_view` to `POST /api/v1/events`. The backend validates each event, writes listening history (play counts, positions, completion), drops event types that admins have disabled, applies the sample rate, and produces the rest to the Redpanda topic `openwav.events`, keyed by user. The recommender consumes the topic. Any other consumer can join with its own group.
