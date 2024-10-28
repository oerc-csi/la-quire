import { deleteAsync } from 'del';
import path from 'node:path';

/**
 * Clean project paths
 *
 * @param  {String}  projectRoot
 * @param  {Array<String>}  paths to
 * @param  {Object}  options
 * @param  {Boolean}  keepLa  Whether to keep linked-art.json
 */
export async function clean(projectRoot, paths, options = {}, keepLa = false) {
  const pathsToClean = [
    path.join(projectRoot, paths.epub),
    path.join(projectRoot, paths.output),
    path.join(projectRoot, '*.epub'),
    path.join(projectRoot, '*.pdf'),
  ];

  // Add Linked Art caches to pathsToClean unless keepLa is provided
  if (!keepLa) {
    pathsToClean.push(path.join(projectRoot, './content/_assets/linked-art.json'));
    pathsToClean.push(path.join(projectRoot, './content/_assets/figures.json'));
  }

  /**
   * Log progress of deleted paths
   * @see https://github.com/sindresorhus/del#onprogress
   *
   * @param  {ProgessData}  progress
   * @see https://github.com/sindresorhus/del#progressdata
   */
  const progressLogger = (progress) => {
    console.info('progress', progress);
  };

  process.cwd(projectRoot);

  const deletedPaths = await deleteAsync(pathsToClean, {
    dryRun: options.dryRun,
    force: true,
    onProgress: (options.progress || options.verbose) && progressLogger,
  });

  return deletedPaths;
}
