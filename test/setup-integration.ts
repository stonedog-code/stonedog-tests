// Real filesystem walks over real repositories are not five-second work, and
// `testTimeout` is not honoured inside a `projects` entry on Jest 29.
//
// Imported rather than taken from the global: under ESM the `jest` global is
// not injected, and referencing it throws "jest is not defined" from the setup
// file, which reads as a broken config rather than a missing import.
import { jest } from "@jest/globals";

jest.setTimeout(60_000);
