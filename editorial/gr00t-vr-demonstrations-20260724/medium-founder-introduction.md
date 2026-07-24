# Why I Started Sim XR

*By Georgy Molodtsov, Founder of Sim XR*

The idea for Sim XR started with a pattern I kept seeing in robotics: a team could iterate on a model quickly, yet gathering the next useful human demonstration still depended on access to a lab, a robot, and the right operator at the same time. Better hardware alone could not solve that data problem. Humanoids and vision-language-action models were becoming more capable, but collecting the right demonstrations remained expensive, geographically constrained, and difficult to repeat. Every new failure could mean another lab session and more scarce robot time.

My belief was that consumer XR could change that operating model. If a person can enter a cloud simulation from a headset, demonstrate the missing behavior, and produce training-ready trajectories, then robot teams can iterate on data before using physical hardware. Remote operators become robot trainers, and simulation becomes more than a place to test policies: it becomes a place to create the human data those policies are missing.

That is why we are building Sim XR: infrastructure that connects remote VR teleoperation, cloud simulation, trajectory validation, VLA fine-tuning, and matched evaluation. The goal is not to produce one impressive rollout. It is to shorten the loop from a specific policy failure to validated new data and a measured result.

NVIDIA’s published Isaac Lab-to-GR00T workflow gave us a rigorous way to test that thesis. Instead of inventing a benchmark that favored our stack, we began with a public task, public data, and a documented training and evaluation pipeline. Then we replaced the source demonstrations with our own remote XR data, changed the task geometry, and finally introduced a new object and destination.

The experiments below are the result.
