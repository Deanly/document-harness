export function quorumHealthy(replicas) {
  return replicas.filter((replica) => replica.healthy).length >= 2;
}
