from collections import deque
G={}
def edge(a,b):
    G.setdefault(a,set()).add(b);G.setdefault(b,set()).add(a)
for a,b in [('G1','G2'),('G2','G3'),('G3','G4'),('G4','G5'),('G5','G6a'),('G5','G6b'),('G6a','G6b'),('F3','F4'),('F4','F5'),('F5','F6a'),('F5','F6b'),('F6a','F6b'),('F1a','F1b')]:edge(a,b)
seen=set();sizes=[]
for node in G:
    if node in seen:continue
    q=[node];seen.add(node);n=0
    while q:
        x=q.pop();n+=1
        for y in G[x]-seen:seen.add(y);q.append(y)
    sizes.append(n)
assert sorted(sizes)==[2,5,7]
assert len(G)==14 and sum(n*n for n in sizes)==78
assert 78-14==64 and 64//2==32
assert sum(n*n for n in [6,4,1])==53
assert abs((5.44-3.58)*500-930)<1e-10
print('Independent validation OK:',sizes,'14 carbon-bound H, 78 ideal coordinates, 64 off-diagonal / 32 unordered pairs; 1.86 ppm at 500 MHz = 930 Hz')
