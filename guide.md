# Paper Reading Share

I was assigned to read the paper [There is no Fork: an Abstraction for Efficient, Concurrent, and Concise Data Access](./assets/there_is_no_fork.pdf) and share my understanding with the team.

## Resources

I've also read through the paper, and also went through:

- The talk ["Haxl: A Big Hammer for Concurrency" by Simon Marlow](https://www.youtube.com/watch?v=sT6VJkkhy0o), the slides of which is [here](./assets/Haxl-A_Big_Hammer_for_Concurency.pdf).
  - [Notes on the talk](./talk-notes.md)
- The Hacker news post about Haxl: [Facebook open sources Haxl](https://news.ycombinator.com/item?id=7873933)

Also, I've asked GPT to summarize the paper, see:

- [Summary of the Paper from ChatGPT](./sum-by-gpt.md)

Also, some Q&A sessions with GPT, see:

- [Q&A with GPT](./q-n-a-with-gpt.md)

## Background

Now I need to prepare a presentation about the paper for the team.

I am a full-stack developer with a strong background in web development, but not familiar with Haskell. And my team is the data engineering team of our company, thus most of other team members are familiar with data engineering like Spark, Flink, HDFS, Doris, Elasticsearch, ClickHouse, etc. However, I am not familiar with these technologies.

## Requirements

The primary goal is to introduce the core ideas of the paper in a way that is easy to understand and follow, and to be able to answer the questions that may arise from the team. Please refer to the resources provided above.

We can craft the slides in a progressive way, first a small and clean version, and then add more content to it based on my feedback or your own ideas.

## Thoughts

About the structure, my opinion is that the "Haxl - the big hammer for concurrency" talk is a good reference, and we can follow its structure, but the talk didn't cover the whole paper (like the implementation details, exceptions, side-effects, evaluation, etc.), so we may need to add some more content to it.

There is a lot of Haskell code in the paper, and it may be hard to understand for those who are not familiar with Haskell like me. So we may need to simplify the code and concepts and explain it in a way that is easy to understand but also accurate.

## About the Slides

This is a project using [Slidev](https://sli.dev/) as the slide engine. I want you to create the slides mostly with the [entry file](./slides.md), which is the entry point of slidev.

Basically, I hope you can arrange the slides in a clean and professional way, and the styles of the slides should be consistent (we already have the "seriph" theme enabled, I think it's a good choice).

During the slides generation, feel free to refer to the Slidev documentation or other related online resources.
