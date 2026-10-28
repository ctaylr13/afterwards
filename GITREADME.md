Build a tiny version of git. Persist real files to a real .minigit directory in the working directory. We expect:

1.  **init** — creates a .minigit directory with whatever subdirectory structure you need.

2.  **add <path>** — stages a file. (Single file is fine; bonus if multiple or globs work.)

3.  **commit -m "<message>"** — commits the staged files. Each commit has a message, an author (hardcode it), a timestamp, a parent commit (or none for the first), and a snapshot of the staged files.

4.  **log** — prints the commit history, newest first. Each entry shows the commit ID, author, timestamp, and message.

5.  **cat-file <id>** — given a commit ID or a blob ID, prints the corresponding stored content.

Storage requirements

-   Files must be stored as **content-addressed blobs** (filename = hash of content). Use any hash you like (sha-1, sha-256, even a simple FNV will do, just be explicit).

-   Commits must form a **chain** via parent pointers.

-   The repository must survive process restarts. Run your commit, exit the process, run log, and the history must still be there.

CLI shape is your call (a script with subcommands, a Node REPL, whatever you can ship fastest). Tests of any kind are welcome but optional. Walk us through your decisions as you go.
