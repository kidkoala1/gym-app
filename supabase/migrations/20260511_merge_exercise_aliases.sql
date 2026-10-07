-- Merge exercise names that are the same movement logged with different wording.
-- Each call points the alias at a canonical group and recomputes workout_exercises.
-- To undo one, point the alias back at itself: select private.set_exercise_alias('x', 'x');

select private.set_exercise_alias('T-row bar', 'T-Bar Row');
select private.set_exercise_alias('Pendulum Squat Machine', 'Pendulum Squat');
select private.set_exercise_alias('Back Extension machine', 'Back Extension');
select private.set_exercise_alias('lat pull down machine', 'Lat Pulldown');
select private.set_exercise_alias('pull ups', 'Pull-Up');
select private.set_exercise_alias('cable tricep extensions', 'Overhead Cable Triceps Extension');
select private.set_exercise_alias('seated cable tricep extension', 'Overhead Cable Triceps Extension');
select private.set_exercise_alias('Incline barbell smith', 'Incline Smith Machine Press');
select private.set_exercise_alias('reverse fly', 'Rear Delt Fly');
select private.set_exercise_alias('Seated Bicep Curl', 'Bicep Curl Machine');
