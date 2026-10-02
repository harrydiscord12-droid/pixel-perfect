# Smooth auto-scroller and motion glow

## Changes
- Replace the stepped autoplay with a continuous, refresh-rate-aware glide that settles cleanly on each item.
- Increase glow dynamically from scroll velocity so moving text visibly lights up, then eases down at rest.
- Preserve wheel, drag, tap, keyboard, reduced-motion behavior, and the editable settings panel.

## Validation
- Check the live preview at desktop size for continuous auto-scroll, interaction, and visible motion glow.
- Confirm the latest preview build completes without errors.
