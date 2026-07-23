# Channel Kit

## Recommended publishing order

1. Publish the full article on Medium as Georgy Molodtsov.
2. Publish a shorter founder post on Georgy’s personal LinkedIn with the video.
3. Publish a more technical company post from the Sim XR LinkedIn page.
4. Cross-post the full article to Substack after the Medium URL is live.
5. Publish a technical experiment card on Hugging Face that links to the article, public evidence, dataset/model pages that are actually shareable, and the source repositories.

Do not publish identical intros everywhere. Medium should own the complete narrative; LinkedIn should lead with the strongest experiment and send readers to the article.

## Medium

**Title:** From Reproduction to New Skills: Teaching GR00T N1.7 with Remote VR Demonstrations

**Subtitle:** What an apple, a mustard bottle, and several thousand closed-loop rollouts taught us about building human-data infrastructure for Physical AI

**Suggested tags:** Robotics, Artificial Intelligence, Virtual Reality, Simulation, Machine Learning

**Hero:** `media/video-cover.jpg`

**Body:** `article.md`

## Georgy’s LinkedIn

We started with an apple.

First, we reproduced NVIDIA’s Unitree G1 apple-to-plate GR00T N1.7 workflow on our own infrastructure. Then we replaced the released demonstrations with 50 demonstrations collected through our own Quest teleoperation stack.

In a matched 100-episode test:

- NVIDIA-data checkpoint: 93/100
- Sim XR Quest checkpoint: 84/100

Moving the task to the other side broke the old policies: 0/20. New right-side VR data brought the result to 74/100—useful progress, but still below our strict continuation gate.

The strongest test was a new task on our Oregon server: mustard bottle → wooden bowl.

- Released apple checkpoint: 0/30
- GR00T N1.7 + 50 Sim XR operator demonstrations: 27/30

The point is not that one model generalized everywhere. It did not. The point is that we now have a repeatable loop:

remote VR teleoperation → validated data → VLA fine-tune → closed-loop evaluation → targeted follow-up data.

[ARTICLE URL]

#PhysicalAI #Robotics #GR00T #IsaacSim #Teleoperation

## Sim XR LinkedIn

Sim XR has completed an end-to-end Isaac Lab-Arena / GR00T N1.7 experiment series that connects remote VR teleoperation to measurable VLA post-training.

Highlights:

- Reproduced NVIDIA’s released apple-to-plate workflow on our own GPU infrastructure.
- Trained an apple policy from 50 selected Quest demonstrations: 84/100 in a matched evaluation versus 93/100 for the NVIDIA-data checkpoint.
- Diagnosed spatial failures and improved a 500-episode benchmark from 80.0% to 89.6% with targeted success-filtered data.
- Built a new mustard-bottle-to-bowl task: the released apple checkpoint scored 0/30; a fresh checkpoint trained on 50 Sim XR operator demonstrations scored 27/30.

These are simulation results, not a real-robot claim. They validate the infrastructure: task composition, remote operator control, data QA, LeRobot conversion, GR00T post-training, and closed-loop evaluation.

Full experiment story: [ARTICLE URL]

#PhysicalAI #RoboticsData #VisionLanguageAction #IsaacLab #VirtualReality

## Substack

Use the Medium title and full article. Add this one-line preface above the body:

> This is a field note from our work at Sim XR: a complete path from a public robot-learning tutorial to new skills trained from remote VR demonstrations.

## Hugging Face experiment card

**Title:** Sim XR Isaac Lab-Arena / GR00T N1.7 VR Demonstration Experiments

**Summary:** A source-backed experiment series covering reproduction of NVIDIA’s static apple-to-plate workflow, a Quest-collected 50-demonstration policy, matched spatial robustness evaluation, targeted self-imitation, a right-side layout shift, and a new mustard-bottle-to-bowl task.

**Report prominently:**

- matched left-side comparison: 93/100 vs 84/100;
- targeted spatial result: 400/500 → 448/500;
- swapped layout: 0/20 old policies, best new result 74/100;
- new task: 0/30 → 27/30 after 50 operator demonstrations.

**Do not upload or link:**

- private checkpoints or datasets without a separate release decision;
- credentials, server addresses, or internal paths;
- a 3DGS or sim-to-real claim without a controlled evaluation.
