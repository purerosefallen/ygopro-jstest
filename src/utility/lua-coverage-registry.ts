import { YGOProTest } from '../ygopro-test';
import {
  createLuaLineCoverage,
  LuaCoverageJson,
  LuaLineCoverage,
  LuaLineCoverageMap,
  normalizeLuaCoverageMap,
  normalizeLuaCoverageName,
  RawLuaCoverageMap,
} from './lua-coverage';

export class LuaCoverageRegistry {
  private filesByName: RawLuaCoverageMap = {};

  add(coverage: LuaLineCoverageMap | RawLuaCoverageMap): this {
    const raw = normalizeLuaCoverageMap(coverage);
    for (const [file, hits] of Object.entries(raw)) {
      const current = (this.filesByName[file] ??= {});
      for (const [line, count] of Object.entries(hits)) {
        const lineNumber = Number(line);
        current[lineNumber] = (current[lineNumber] ?? 0) + count;
      }
    }
    return this;
  }

  addFrom(ctx: YGOProTest): this {
    return this.add(ctx.getAllCoverages());
  }

  merge(other: LuaCoverageRegistry): this {
    return this.add(other.filesByName);
  }

  clear(name?: string): this {
    if (name == null) {
      this.filesByName = {};
    } else {
      delete this.filesByName[normalizeLuaCoverageName(name)];
    }
    return this;
  }

  getCoverage(name: string): LuaLineCoverage {
    const file = normalizeLuaCoverageName(name);
    return createLuaLineCoverage(file, { ...(this.filesByName[file] ?? {}) });
  }

  getAllCoverages(): LuaLineCoverageMap {
    const result: LuaLineCoverageMap = {};
    for (const file of this.files()) {
      result[file] = this.getCoverage(file);
    }
    return result;
  }

  has(name: string): boolean {
    return normalizeLuaCoverageName(name) in this.filesByName;
  }

  files(): string[] {
    return Object.keys(this.filesByName).sort();
  }

  toJSON(): LuaCoverageJson {
    return {
      files: normalizeLuaCoverageMap(this.filesByName),
    };
  }

  loadJSON(json: LuaCoverageJson): this {
    this.filesByName = {};
    return this.add(json.files);
  }
}
