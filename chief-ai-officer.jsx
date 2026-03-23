import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const DEPARTMENTS = [
  { id: "strategy",  label: "Strategy",    icon: "◈", color: "#C8A96E" },
  { id: "dev",       label: "Engineering", icon: "⬡", color: "#6EC8A9" },
  { id: "marketing", label: "Marketing",   icon: "◉", color: "#A96EC8" },
  { id: "outreach",  label: "Outreach",    icon: "◎", color: "#6E9EC8" },
  { id: "ops",       label: "Ops & Data",  icon: "⬢", color: "#C86E6E" },
];

const INTEGRATIONS_TEMPLATE = [
  { id: "github",   label: "GitHub",    icon: "⬡", connected: false, key: "" },
  { id: "resend",   label: "Resend",    icon: "◎", connected: false, key: "" },
  { id: "linkedin", label: "LinkedIn",  icon: "◈", connected: false, key: "" },
  { id: "twitter",  label: "Twitter/X", icon: "◉", connected: false, key: "" },
  { id: "vercel",   label: "Vercel",    icon: "▲", connected: false, key: "" },
  { id: "supabase", label: "Supabase",  icon: "⬢", connected: false, key: "" },
];

const PROJECT_COLORS = [
  "#C8A96E","#6EC8A9","#A96EC8","#6E9EC8","#C86E6E",
  "#9EC86E","#C86EA9","#6EC8C8","#C8C86E",
];

const STAGES = ["pre-launch","MVP","growth","scaling","profitable"];

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2,9);

function timeAgo(ts) {
  const s = Math.floor((Date.now()-ts)/1000);
  if(s<60) return `${s}s ago`;
  if(s<3600) return `${Math.floor(s/60)}m ago`;
  if(s<86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function buildSystemPrompt(project) {
  const conn = project.integrations.filter(i=>i.connected).map(i=>i.label).join(", ")||"none";
  return `You are CAIO — Chief AI Intelligence Officer. You run companies autonomously.

COMPANY: ${project.name}
IDEA: ${project.idea}
STAGE: ${project.stage}
CYCLE: ${project.cycles.length+1}
CONNECTED TOOLS: ${conn}

YOUR ROLE: Autonomous executive agent. Think, plan, delegate, execute. No hedging.
5 departments: Strategy, Engineering, Marketing, Outreach, Ops & Data.

RESPONSE FORMAT — strict JSON only:
{
  "thought": "Internal executive reasoning (1-2 sentences)",
  "decisions": [
    {
      "department": "strategy|dev|marketing|outreach|ops",
      "action": "Short action title",
      "detail": "What exactly will be done",
      "priority": "high|medium|low",
      "requires_approval": true,
      "estimated_time": "2h",
      "output": "What will be produced"
    }
  ],
  "daily_report": {
    "headline": "One-line executive summary",
    "metrics": [{"label":"Metric","value":"val","trend":"up|down|flat"}],
    "blockers": ["blocker"],
    "next_focus": "Tomorrow priority"
  },
  "message": "Direct executive message to founder. Max 3 sentences."
}

RULES:
- External actions (send email, post, deploy, merge code) requires_approval: true
- Internal work (write copy, generate code locally, analyze) requires_approval: false
- Generate 3-7 concrete decisions. Prioritize revenue.
- Flag missing integrations as "blocked: missing key".`;
}

// ─── STORAGE ──────────────────────────────────────────────────────────────────

function loadState() {
  try { const r=localStorage.getItem("caio_v2"); return r?JSON.parse(r):null; } catch{return null;}
}
function saveState(s) {
  try { localStorage.setItem("caio_v2",JSON.stringify(s)); } catch{}
}

// ─── TINY COMPONENTS ─────────────────────────────────────────────────────────

function Pulse({color="#6EC8A9",size=8}){
  return(
    <span style={{position:"relative",display:"inline-block",width:size,height:size,flexShrink:0}}>
      <span style={{position:"absolute",inset:0,borderRadius:"50%",background:color,opacity:0.3,animation:"ping 1.5s ease-in-out infinite"}}/>
      <span style={{position:"absolute",inset:2,borderRadius:"50%",background:color}}/>
    </span>
  );
}

function TermLine({text,type="info",delay=0}){
  const C={info:"#8899BB",success:"#6EC8A9",warn:"#C8A96E",error:"#C86E6E",cmd:"#C8C8D4"};
  const P={info:"›",success:"✓",warn:"⚠",error:"✗",cmd:"$"};
  return(
    <div style={{fontFamily:"monospace",fontSize:11,color:C[type],lineHeight:1.6,opacity:0,animation:`fadeIn 0.3s ease ${delay}ms forwards`,display:"flex",gap:8}}>
      <span style={{opacity:0.5,flexShrink:0}}>{P[type]}</span>
      <span style={{wordBreak:"break-word"}}>{text}</span>
    </div>
  );
}

function Pill({label,value,trend}){
  const tc={up:"#6EC8A9",down:"#C86E6E",flat:"#8899BB"}[trend]||"#8899BB";
  const ti={up:"↑",down:"↓",flat:"→"}[trend]||"→";
  return(
    <div style={{background:"#ffffff08",border:"1px solid #ffffff11",borderRadius:6,padding:"8px 12px",minWidth:90}}>
      <div style={{fontFamily:"monospace",fontSize:9,color:"#6677AA",marginBottom:3,textTransform:"uppercase",letterSpacing:0.5}}>{label}</div>
      <div style={{display:"flex",alignItems:"baseline",gap:4}}>
        <span style={{color:"#E8E8F4",fontWeight:700,fontSize:15}}>{value}</span>
        <span style={{color:tc,fontSize:10}}>{ti}</span>
      </div>
    </div>
  );
}

// ─── DECISION CARD ────────────────────────────────────────────────────────────

function DecisionCard({decision,cycleId,projectId,onAction,index}){
  const dept=DEPARTMENTS.find(d=>d.id===decision.department)||DEPARTMENTS[0];
  const pc={high:"#C86E6E",medium:"#C8A96E",low:"#6E9EC8"}[decision.priority]||"#8899BB";
  const [acted,setActed]=useState(decision.approved!==undefined);
  useEffect(()=>{setActed(decision.approved!==undefined);},[decision.approved]);

  return(
    <div style={{border:`1px solid ${decision.requires_approval?"#C8A96E2A":"#ffffff0D"}`,borderLeft:`3px solid ${dept.color}`,background:decision.requires_approval?"#C8A96E06":"#ffffff04",borderRadius:6,padding:"12px 14px",marginBottom:8,opacity:0,animation:`slideUp 0.35s ease ${index*60}ms forwards`}}>
      <div style={{display:"flex",justifyContent:"space-between",gap:10}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5,flexWrap:"wrap"}}>
            <span style={{color:dept.color,fontSize:11}}>{dept.icon}</span>
            <span style={{fontFamily:"monospace",fontSize:9,color:dept.color,textTransform:"uppercase",letterSpacing:1}}>{dept.label}</span>
            <span style={{fontSize:9,color:pc,background:`${pc}18`,padding:"1px 5px",borderRadius:3,fontFamily:"monospace"}}>{decision.priority}</span>
            {decision.requires_approval&&<span style={{fontSize:9,color:"#C8A96E",background:"#C8A96E18",padding:"1px 5px",borderRadius:3,fontFamily:"monospace"}}>⚑ approval</span>}
          </div>
          <div style={{color:"#E8E8F4",fontWeight:600,fontSize:12,marginBottom:3}}>{decision.action}</div>
          <div style={{color:"#8899BB",fontSize:11,lineHeight:1.5,marginBottom:5}}>{decision.detail}</div>
          <div style={{display:"flex",gap:12,fontSize:10,color:"#556677"}}>
            <span>⏱ {decision.estimated_time}</span>
            <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>→ {decision.output}</span>
          </div>
        </div>
        <div style={{flexShrink:0,display:"flex",flexDirection:"column",gap:5}}>
          {decision.requires_approval&&!acted&&(
            <>
              <button onClick={()=>{setActed(true);onAction(projectId,cycleId,decision.id,true);}} style={BS("#6EC8A9")}>✓</button>
              <button onClick={()=>{setActed(true);onAction(projectId,cycleId,decision.id,false);}} style={BS("#C86E6E")}>✗</button>
            </>
          )}
          {acted&&decision.approved!==undefined&&(
            <span style={{fontFamily:"monospace",fontSize:10,color:decision.approved?"#6EC8A9":"#C86E6E",padding:"3px 8px",border:`1px solid ${decision.approved?"#6EC8A944":"#C86E6E44"}`,borderRadius:4}}>
              {decision.approved?"✓":"✗"}
            </span>
          )}
          {!decision.requires_approval&&(
            <span style={{fontFamily:"monospace",fontSize:10,color:"#C8A96E",padding:"3px 8px",border:"1px solid #C8A96E33",borderRadius:4}}>⚡</span>
          )}
        </div>
      </div>
    </div>
  );
}
const BS=color=>({background:"transparent",border:`1px solid ${color}55`,color,fontFamily:"monospace",fontSize:12,padding:"4px 10px",borderRadius:4,cursor:"pointer",transition:"all 0.15s"});

// ─── PROJECT CARD (portfolio) ─────────────────────────────────────────────────

function ProjectCard({project,isRunning,onClick,onDelete}){
  const latest=project.cycles[project.cycles.length-1];
  const pending=latest?.decisions?.filter(d=>d.requires_approval&&d.approved===undefined).length||0;
  const totalD=project.cycles.flatMap(c=>c.decisions).length;
  const approved=project.cycles.flatMap(c=>c.decisions).filter(d=>d.approved===true).length;
  const [hov,setHov]=useState(false);

  return(
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{border:`1px solid ${project.color}33`,borderTop:`3px solid ${project.color}`,background:hov?"#ffffff08":"#ffffff04",borderRadius:8,padding:"16px",cursor:"pointer",transition:"all 0.2s",position:"relative",animation:"slideUp 0.3s ease forwards"}}>
      <button onClick={e=>{e.stopPropagation();onDelete(project.id);}} style={{position:"absolute",top:10,right:10,background:"none",border:"none",color:"#334455",cursor:"pointer",fontSize:15,lineHeight:1,padding:4}} title="Delete">×</button>

      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        {isRunning&&<Pulse color={project.color}/>}
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#E8E8F4",fontWeight:700}}>{project.name}</span>
      </div>

      <div style={{fontFamily:"monospace",fontSize:10,color:"#6677AA",marginBottom:8,lineHeight:1.5,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{project.idea}</div>

      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        <span style={{fontFamily:"monospace",fontSize:9,color:project.color,background:`${project.color}18`,padding:"2px 7px",borderRadius:3}}>{project.stage}</span>
        <span style={{fontFamily:"monospace",fontSize:9,color:"#6677AA",background:"#ffffff0A",padding:"2px 7px",borderRadius:3}}>{project.cycles.length} cycles</span>
        {pending>0&&<span style={{fontFamily:"monospace",fontSize:9,color:"#C8A96E",background:"#C8A96E18",padding:"2px 7px",borderRadius:3}}>⚑ {pending} pending</span>}
        {isRunning&&<span style={{fontFamily:"monospace",fontSize:9,color:"#6EC8A9",background:"#6EC8A918",padding:"2px 7px",borderRadius:3}}>⟳ running</span>}
      </div>

      <div style={{display:"flex",gap:14}}>
        {[{l:"decisions",v:totalD},{l:"approved",v:approved}].map(m=>(
          <div key={m.l}>
            <div style={{fontFamily:"monospace",fontSize:9,color:"#445566",textTransform:"uppercase"}}>{m.l}</div>
            <div style={{fontFamily:"monospace",fontSize:14,color:"#C8D8E8",fontWeight:700}}>{m.v}</div>
          </div>
        ))}
      </div>

      {latest?.report?.headline&&(
        <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #ffffff0A",fontFamily:"monospace",fontSize:10,color:"#556677",lineHeight:1.4}}>{latest.report.headline}</div>
      )}
    </div>
  );
}

// ─── NEW PROJECT MODAL ────────────────────────────────────────────────────────

function NewProjectModal({onClose,onCreate,colorIndex}){
  const [name,setName]=useState("");
  const [idea,setIdea]=useState("");
  const [stage,setStage]=useState("pre-launch");
  const [integrations,setIntegrations]=useState(INTEGRATIONS_TEMPLATE.map(i=>({...i})));
  const color=PROJECT_COLORS[colorIndex%PROJECT_COLORS.length];
  const toggle=id=>setIntegrations(prev=>prev.map(i=>i.id===id?{...i,connected:!i.connected}:i));
  const ok=name.trim()&&idea.trim();

  return(
    <div style={{position:"fixed",inset:0,background:"#0A0A14EE",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:24}}>
      <div style={{background:"#12121E",border:"1px solid #ffffff15",borderTop:`3px solid ${color}`,borderRadius:10,width:"100%",maxWidth:540,maxHeight:"90vh",overflow:"auto",padding:28}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
          <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:"#E8E8F4",margin:0}}>New Project</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:"#556677",cursor:"pointer",fontSize:20,lineHeight:1}}>×</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:16}}>
          <div>
            <label style={LS}>Project Name</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="FlowSync, NicheHunt..." style={IS} autoFocus/>
          </div>
          <div>
            <label style={LS}>Idea / Spec</label>
            <textarea value={idea} onChange={e=>setIdea(e.target.value)} placeholder="Describe the problem, target market, constraints..." rows={4} style={{...IS,resize:"vertical",fontFamily:"inherit"}}/>
          </div>
          <div>
            <label style={LS}>Current Stage</label>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {STAGES.map(s=>(
                <button key={s} onClick={()=>setStage(s)} style={{background:stage===s?`${color}22`:"transparent",border:`1px solid ${stage===s?color:"#ffffff15"}`,color:stage===s?color:"#667788",borderRadius:5,padding:"5px 12px",fontFamily:"monospace",fontSize:11,cursor:"pointer"}}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={LS}>Integrations</label>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {integrations.map(integ=>(
                <div key={integ.id} onClick={()=>toggle(integ.id)} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",background:integ.connected?`${color}0A`:"#ffffff06",border:`1px solid ${integ.connected?`${color}44`:"#ffffff0D"}`,borderRadius:5,cursor:"pointer",transition:"all 0.15s"}}>
                  <span style={{fontSize:10,color:integ.connected?color:"#334455"}}>●</span>
                  <span style={{fontFamily:"monospace",fontSize:11,color:integ.connected?"#C8D8E8":"#445566"}}>{integ.label}</span>
                </div>
              ))}
            </div>
          </div>
          <button onClick={()=>ok&&onCreate({name:name.trim(),idea:idea.trim(),stage,integrations,color})} disabled={!ok}
            style={{background:ok?color:"#223344",color:ok?"#0F0F1A":"#445566",border:"none",borderRadius:6,padding:"12px",fontFamily:"monospace",fontSize:12,fontWeight:700,cursor:ok?"pointer":"not-allowed",letterSpacing:0.5,marginTop:4}}>
            LAUNCH PROJECT →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PROJECT WORKSPACE ────────────────────────────────────────────────────────

function ProjectWorkspace({project,isRunning,onRunCycle,onAction,onBack,onUpdateStage}){
  const [tab,setTab]=useState("decisions");
  const termRef=useRef(null);

  useEffect(()=>{
    if(termRef.current) termRef.current.scrollTop=termRef.current.scrollHeight;
  },[project.termLines]);

  const latest=project.cycles[project.cycles.length-1];
  const pending=latest?.decisions?.filter(d=>d.requires_approval&&d.approved===undefined)||[];
  const totalD=project.cycles.flatMap(c=>c.decisions).length;
  const approvedC=project.cycles.flatMap(c=>c.decisions).filter(d=>d.approved===true).length;

  return(
    <div style={{display:"flex",flexDirection:"column",height:"100vh",overflow:"hidden"}}>
      {/* Header */}
      <div style={{borderBottom:"1px solid #ffffff0D",padding:"10px 20px",display:"flex",alignItems:"center",gap:12,background:"#0C0C18",flexShrink:0}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#556677",cursor:"pointer",fontFamily:"monospace",fontSize:11,display:"flex",alignItems:"center",gap:4,flexShrink:0}}>← portfolio</button>
        <span style={{color:"#ffffff15"}}>|</span>
        <span style={{width:8,height:8,borderRadius:"50%",background:project.color,flexShrink:0,display:"inline-block"}}/>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:15,color:"#E8E8F4",fontWeight:700,flexShrink:0}}>{project.name}</span>
        {isRunning&&<Pulse color={project.color}/>}
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {STAGES.map(s=>(
            <button key={s} onClick={()=>onUpdateStage(project.id,s)} style={{background:project.stage===s?`${project.color}22`:"transparent",border:`1px solid ${project.stage===s?project.color:"#ffffff10"}`,color:project.stage===s?project.color:"#445566",borderRadius:4,padding:"2px 7px",fontFamily:"monospace",fontSize:9,cursor:"pointer"}}>{s}</button>
          ))}
        </div>
        <div style={{flex:1}}/>
        <button onClick={()=>onRunCycle(project.id)} disabled={isRunning}
          style={{background:isRunning?"#1A2233":project.color,color:isRunning?"#445566":"#0F0F1A",border:"none",borderRadius:4,padding:"6px 14px",fontFamily:"monospace",fontSize:11,fontWeight:700,cursor:isRunning?"not-allowed":"pointer",letterSpacing:0.5,transition:"all 0.2s",flexShrink:0}}>
          {isRunning?"⟳ RUNNING...":"⚡ RUN CYCLE"}
        </button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 290px",flex:1,overflow:"hidden"}}>
        {/* Main */}
        <div style={{display:"flex",flexDirection:"column",overflow:"hidden"}}>
          <div style={{padding:"12px 20px",borderBottom:"1px solid #ffffff08",display:"flex",gap:8,flexWrap:"wrap",flexShrink:0}}>
            <Pill label="Cycles" value={project.cycles.length} trend="up"/>
            <Pill label="Decisions" value={totalD} trend="up"/>
            <Pill label="Approved" value={approvedC} trend="up"/>
            <Pill label="Pending" value={pending.length} trend="flat"/>
            {latest?.report?.metrics?.slice(0,2).map((m,i)=><Pill key={i} {...m}/>)}
          </div>

          {latest?.message&&(
            <div style={{margin:"12px 20px 0",padding:"12px 14px",background:`${project.color}0A`,border:`1px solid ${project.color}22`,borderLeft:`3px solid ${project.color}`,borderRadius:6,flexShrink:0}}>
              <div style={{fontFamily:"monospace",fontSize:9,color:project.color,marginBottom:6,letterSpacing:1}}>◈ CAIO — {timeAgo(latest.timestamp)}</div>
              <div style={{color:"#D8D8E8",fontSize:12,lineHeight:1.6,fontStyle:"italic"}}>"{latest.message}"</div>
              {latest.thought&&<div style={{marginTop:6,fontSize:10,color:"#445566",fontFamily:"monospace"}}>↳ {latest.thought}</div>}
            </div>
          )}

          <div style={{display:"flex",padding:"12px 20px 0",borderBottom:"1px solid #ffffff08",flexShrink:0}}>
            {[{id:"decisions",label:"Decisions",count:latest?.decisions?.length},{id:"history",label:"History",count:project.cycles.length},{id:"report",label:"Report"}].map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} style={{background:"none",border:"none",borderBottom:`2px solid ${tab===t.id?project.color:"transparent"}`,color:tab===t.id?project.color:"#556677",padding:"6px 14px",fontFamily:"monospace",fontSize:11,cursor:"pointer",display:"flex",gap:5,alignItems:"center"}}>
                {t.label}
                {t.count!=null&&<span style={{background:tab===t.id?`${project.color}22`:"#ffffff0D",color:tab===t.id?project.color:"#556677",borderRadius:3,padding:"0 4px",fontSize:9}}>{t.count}</span>}
              </button>
            ))}
          </div>

          <div style={{flex:1,overflow:"auto",padding:"14px 20px"}}>
            {tab==="decisions"&&(
              <div>
                {pending.length>0&&<div style={{marginBottom:12,padding:"8px 12px",background:"#C8A96E08",border:"1px solid #C8A96E33",borderRadius:5,fontFamily:"monospace",fontSize:10,color:"#C8A96E"}}>⚑ {pending.length} action{pending.length>1?"s":""} awaiting approval</div>}
                {isRunning&&!latest?.decisions?.length&&<div style={{padding:"40px 0",textAlign:"center",fontFamily:"monospace",fontSize:12,color:"#6677AA",animation:"pulse 1.5s ease infinite"}}>CAIO is thinking...</div>}
                {latest?.decisions?.map((d,i)=><DecisionCard key={d.id} decision={d} cycleId={latest.id} projectId={project.id} onAction={onAction} index={i}/>)}
                {!isRunning&&!latest&&<div style={{padding:"50px 0",textAlign:"center",color:"#334455",fontFamily:"monospace",fontSize:11}}>No cycles yet — hit RUN CYCLE.</div>}
              </div>
            )}

            {tab==="history"&&(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {[...project.cycles].reverse().map((cycle,i)=>(
                  <div key={cycle.id} style={{border:"1px solid #ffffff0D",borderRadius:7,padding:"12px 14px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                      <div style={{display:"flex",gap:8}}>
                        <span style={{fontFamily:"monospace",fontSize:9,color:"#6677AA"}}>CYCLE {project.cycles.length-i}</span>
                        <span style={{fontFamily:"monospace",fontSize:9,color:"#334455"}}>{timeAgo(cycle.timestamp)}</span>
                      </div>
                      <div style={{display:"flex",gap:8,fontSize:9,fontFamily:"monospace"}}>
                        <span style={{color:"#6EC8A9"}}>✓ {cycle.decisions.filter(d=>d.approved===true).length}</span>
                        <span style={{color:"#C86E6E"}}>✗ {cycle.decisions.filter(d=>d.approved===false).length}</span>
                        <span style={{color:"#C8A96E"}}>⚡ {cycle.decisions.filter(d=>!d.requires_approval).length}</span>
                      </div>
                    </div>
                    {cycle.report?.headline&&<div style={{color:"#B8C8D8",fontSize:11,marginBottom:4}}>{cycle.report.headline}</div>}
                    {cycle.report?.next_focus&&<div style={{fontSize:10,color:"#445566",fontFamily:"monospace"}}>Next: {cycle.report.next_focus}</div>}
                  </div>
                ))}
              </div>
            )}

            {tab==="report"&&!latest?.report&&<div style={{padding:"50px 0",textAlign:"center",color:"#334455",fontFamily:"monospace",fontSize:11}}>No report yet.</div>}
            {tab==="report"&&latest?.report&&(
              <div style={{display:"flex",flexDirection:"column",gap:18}}>
                <div>
                  <div style={{fontFamily:"monospace",fontSize:9,color:"#6677AA",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Executive Summary</div>
                  <div style={{color:"#E8E8F4",fontSize:14,fontWeight:600,lineHeight:1.5}}>{latest.report.headline}</div>
                </div>
                {latest.report.metrics?.length>0&&(
                  <div>
                    <div style={{fontFamily:"monospace",fontSize:9,color:"#6677AA",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>Metrics</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{latest.report.metrics.map((m,i)=><Pill key={i} {...m}/>)}</div>
                  </div>
                )}
                {latest.report.blockers?.length>0&&(
                  <div>
                    <div style={{fontFamily:"monospace",fontSize:9,color:"#C86E6E",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Blockers</div>
                    {latest.report.blockers.map((b,i)=><div key={i} style={{fontFamily:"monospace",fontSize:11,color:"#AA8888",padding:"5px 8px",background:"#C86E6E0A",borderRadius:4,marginBottom:4}}>⚠ {b}</div>)}
                  </div>
                )}
                {latest.report.next_focus&&(
                  <div>
                    <div style={{fontFamily:"monospace",fontSize:9,color:"#6677AA",marginBottom:6,textTransform:"uppercase",letterSpacing:1}}>Tomorrow</div>
                    <div style={{color:"#8899BB",fontSize:12,fontStyle:"italic"}}>{latest.report.next_focus}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{borderLeft:"1px solid #ffffff08",display:"flex",flexDirection:"column",overflow:"hidden",background:"#0A0A14"}}>
          <div style={{padding:"12px 14px",borderBottom:"1px solid #ffffff08",flexShrink:0}}>
            <div style={{fontFamily:"monospace",fontSize:9,color:"#334455",marginBottom:8,letterSpacing:1,textTransform:"uppercase"}}>Integrations</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
              {project.integrations.map(integ=>(
                <div key={integ.id} style={{display:"flex",alignItems:"center",gap:5}}>
                  <span style={{fontSize:7,color:integ.connected?"#6EC8A9":"#223344"}}>●</span>
                  <span style={{fontFamily:"monospace",fontSize:9,color:integ.connected?"#8899BB":"#334455"}}>{integ.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{padding:"10px 14px",borderBottom:"1px solid #ffffff08",flexShrink:0}}>
            <div style={{fontFamily:"monospace",fontSize:9,color:"#334455",marginBottom:5,letterSpacing:1,textTransform:"uppercase"}}>Mission</div>
            <div style={{fontFamily:"monospace",fontSize:10,color:"#7788AA",lineHeight:1.5,maxHeight:52,overflow:"hidden"}}>{project.idea}</div>
          </div>

          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"8px 14px",borderBottom:"1px solid #ffffff08",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:"#C86E6E",display:"inline-block"}}/>
              <span style={{width:7,height:7,borderRadius:"50%",background:"#C8A96E",display:"inline-block"}}/>
              <span style={{width:7,height:7,borderRadius:"50%",background:"#6EC8A9",display:"inline-block"}}/>
              <span style={{fontFamily:"monospace",fontSize:9,color:"#334455",marginLeft:2}}>{project.name}.log</span>
            </div>
            <div ref={termRef} style={{flex:1,overflow:"auto",padding:"10px 14px",display:"flex",flexDirection:"column",gap:2}}>
              {(!project.termLines||project.termLines.length===0)&&<TermLine text="CAIO ready. Run a cycle to start." type="info"/>}
              {(project.termLines||[]).map(l=><TermLine key={l.id} text={l.text} type={l.type} delay={0}/>)}
              {isRunning&&<span style={{fontFamily:"monospace",fontSize:11,color:"#6EC8A9",animation:"blink 1s step-end infinite"}}>▌</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function CAIO(){
  const [appState,setAppState]=useState(()=>loadState()||{apiKey:"",projects:[],activeId:null,view:"portfolio"});
  const [running,setRunning]=useState(new Set());
  const [showNew,setShowNew]=useState(false);
  const [showKey,setShowKey]=useState(false);
  const [keyDraft,setKeyDraft]=useState("");

  const {apiKey,projects,activeId,view}=appState;

  useEffect(()=>{ saveState(appState); },[appState]);

  const set=useCallback(fn=>setAppState(p=>({...p,...fn(p)})),[]);
  const updProject=useCallback((id,fn)=>setAppState(p=>({...p,projects:p.projects.map(pr=>pr.id===id?fn(pr):pr)})),[]);

  const addLine=useCallback((pid,text,type="info")=>{
    const line={id:genId(),text,type,delay:0};
    updProject(pid,p=>({...p,termLines:[...(p.termLines||[]).slice(-60),line]}));
  },[updProject]);

  const createProject=useCallback(({name,idea,stage,integrations,color})=>{
    const np={id:genId(),name,idea,stage,integrations,color,cycles:[],termLines:[],createdAt:Date.now()};
    setAppState(p=>({...p,projects:[...p.projects,np],activeId:np.id,view:"workspace"}));
    setShowNew(false);
  },[]);

  const deleteProject=useCallback(id=>{
    setAppState(p=>({...p,projects:p.projects.filter(pr=>pr.id!==id),activeId:p.activeId===id?null:p.activeId,view:p.activeId===id?"portfolio":p.view}));
  },[]);

  const handleAction=useCallback((pid,cycleId,decId,approved)=>{
    addLine(pid,`${approved?"Approved":"Rejected"} decision ${decId}`,approved?"success":"warn");
    updProject(pid,p=>({...p,cycles:p.cycles.map(c=>c.id===cycleId?{...c,decisions:c.decisions.map(d=>d.id===decId?{...d,approved}:d)}:c)}));
  },[addLine,updProject]);

  const runCycle=useCallback(async(pid)=>{
    if(running.has(pid)) return;
    if(!apiKey){setShowKey(true);return;}
    setRunning(prev=>new Set([...prev,pid]));
    const project=appState.projects.find(p=>p.id===pid);
    if(!project){setRunning(prev=>{const s=new Set(prev);s.delete(pid);return s;});return;}

    addLine(pid,`Starting cycle ${project.cycles.length+1}`,"cmd");
    addLine(pid,`Stage: ${project.stage} | Tools: ${project.integrations.filter(i=>i.connected).map(i=>i.label).join(", ")||"none"}`,"info");
    addLine(pid,"Calling Claude...","cmd");

    const sys=buildSystemPrompt(project);
    const usr=project.cycles.length===0
      ?`INITIAL BRIEFING:\n\nIdea/Spec: ${project.idea}\n\nCycle 1: Create foundational strategy, first engineering tasks, marketing and outreach plan. Be specific and decisive.`
      :`DAILY CYCLE ${project.cycles.length+1}:\n\nPrevious: ${project.cycles[project.cycles.length-1]?.report?.headline||"N/A"}\nApproved: ${project.cycles[project.cycles.length-1]?.decisions?.filter(d=>d.approved).length||0} | Rejected: ${project.cycles[project.cycles.length-1]?.decisions?.filter(d=>d.approved===false).length||0}\n\nRun next autonomous cycle. Adapt.`;

    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:2000,system:sys,messages:[{role:"user",content:usr}]}),
      });
      const data=await res.json();
      if(data.error){addLine(pid,`API Error: ${data.error.message}`,"error");setRunning(prev=>{const s=new Set(prev);s.delete(pid);return s;});return;}
      const raw=data.content?.[0]?.text||"";
      addLine(pid,"Parsing decisions...","success");
      let parsed;
      try{const m=raw.match(/\{[\s\S]*\}/);parsed=JSON.parse(m?.[0]||raw);}
      catch{addLine(pid,"Parse error","warn");parsed={thought:"",decisions:[],daily_report:{headline:"Parse error",metrics:[],blockers:[],next_focus:""},message:raw.slice(0,200)};}
      const decisions=(parsed.decisions||[]).map(d=>({...d,id:genId(),approved:d.requires_approval?undefined:true}));
      addLine(pid,`Generated ${decisions.length} decisions`,"success");
      decisions.forEach(d=>addLine(pid,`[${(d.department||"?").toUpperCase()}] ${d.action} — ${d.requires_approval?"⚑ needs approval":"⚡ auto"}`,d.requires_approval?"warn":"success"));
      const nc={id:genId(),timestamp:Date.now(),status:"waiting",decisions,report:parsed.daily_report||{},message:parsed.message||"",thought:parsed.thought||""};
      updProject(pid,p=>({...p,cycles:[...p.cycles,nc]}));
    }catch(err){addLine(pid,`Error: ${err.message}`,"error");}
    setRunning(prev=>{const s=new Set(prev);s.delete(pid);return s;});
  },[running,apiKey,appState.projects,addLine,updProject]);

  const activeProject=projects.find(p=>p.id===activeId);
  const totalPending=projects.flatMap(p=>p.cycles.flatMap(c=>c.decisions)).filter(d=>d.requires_approval&&d.approved===undefined).length;

  return(
    <div style={{background:"#0F0F1A",minHeight:"100vh",color:"#E8E8F4",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <style>{CSS}</style>

      {/* API Key Modal */}
      {showKey&&(
        <div style={{position:"fixed",inset:0,background:"#0A0A14EE",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:24}}>
          <div style={{background:"#12121E",border:"1px solid #ffffff15",borderTop:"3px solid #C8A96E",borderRadius:10,width:"100%",maxWidth:400,padding:28}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:20}}>
              <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#E8E8F4",margin:0}}>Anthropic API Key</h2>
              <button onClick={()=>setShowKey(false)} style={{background:"none",border:"none",color:"#556677",cursor:"pointer",fontSize:20}}>×</button>
            </div>
            <input type="password" placeholder="sk-ant-..." value={keyDraft||apiKey} onChange={e=>setKeyDraft(e.target.value)} style={IS} autoFocus/>
            <div style={{fontSize:10,color:"#445566",fontFamily:"monospace",marginTop:6,marginBottom:16}}>Stored in localStorage. Used client-side only.</div>
            <button onClick={()=>{set(()=>({apiKey:keyDraft||apiKey}));setShowKey(false);setKeyDraft("");}} style={{background:"#C8A96E",color:"#0F0F1A",border:"none",borderRadius:5,padding:"10px 20px",fontFamily:"monospace",fontSize:12,fontWeight:700,cursor:"pointer",width:"100%"}}>SAVE KEY</button>
          </div>
        </div>
      )}

      {showNew&&<NewProjectModal onClose={()=>setShowNew(false)} onCreate={createProject} colorIndex={projects.length}/>}

      {/* PORTFOLIO */}
      {view==="portfolio"&&(
        <div style={{minHeight:"100vh",display:"flex",flexDirection:"column"}}>
          <div style={{borderBottom:"1px solid #ffffff0D",padding:"12px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",background:"#0C0C18"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:"#C8A96E",fontWeight:700}}>CAIO</span>
              <span style={{fontFamily:"monospace",fontSize:10,color:"#445566"}}>Chief AI Intelligence Officer</span>
              {running.size>0&&<><Pulse color="#6EC8A9"/><span style={{fontFamily:"monospace",fontSize:10,color:"#6EC8A9"}}>{running.size} running</span></>}
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {totalPending>0&&<span style={{fontFamily:"monospace",fontSize:10,color:"#C8A96E",background:"#C8A96E15",padding:"3px 8px",borderRadius:4,border:"1px solid #C8A96E33"}}>⚑ {totalPending} pending</span>}
              <button onClick={()=>setShowKey(true)} style={{background:apiKey?"#6EC8A908":"#C86E6E0A",border:`1px solid ${apiKey?"#6EC8A933":"#C86E6E44"}`,color:apiKey?"#6EC8A9":"#C86E6E",borderRadius:4,padding:"5px 10px",fontFamily:"monospace",fontSize:10,cursor:"pointer"}}>
                {apiKey?"✓ API key set":"⚠ Set API key"}
              </button>
              <button onClick={()=>setShowNew(true)} style={{background:"#C8A96E",color:"#0F0F1A",border:"none",borderRadius:4,padding:"6px 14px",fontFamily:"monospace",fontSize:11,fontWeight:700,cursor:"pointer"}}>+ New Project</button>
            </div>
          </div>

          <div style={{flex:1,padding:"24px",maxWidth:1100,width:"100%",margin:"0 auto"}}>
            {projects.length===0?(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",minHeight:400,gap:20}}>
                <div style={{fontFamily:"'Playfair Display',serif",fontSize:"clamp(32px,5vw,52px)",color:"#E8E8F4",textAlign:"center",lineHeight:1.2}}>Your<br/><span style={{color:"#C8A96E"}}>AI-run</span><br/>portfolio</div>
                <div style={{fontFamily:"monospace",fontSize:12,color:"#556677",textAlign:"center",maxWidth:340,lineHeight:1.6}}>Each project gets its own CAIO instance — strategy, engineering, marketing, outreach, ops. You validate once a day.</div>
                <button onClick={()=>{if(!apiKey)setShowKey(true);else setShowNew(true);}} style={{background:"#C8A96E",color:"#0F0F1A",border:"none",borderRadius:6,padding:"12px 24px",fontFamily:"monospace",fontSize:12,fontWeight:700,cursor:"pointer",letterSpacing:0.5}}>+ LAUNCH FIRST PROJECT</button>
              </div>
            ):(
              <>
                <div style={{display:"flex",gap:10,marginBottom:24,flexWrap:"wrap"}}>
                  <Pill label="Projects" value={projects.length} trend="up"/>
                  <Pill label="Total Cycles" value={projects.reduce((a,p)=>a+p.cycles.length,0)} trend="up"/>
                  <Pill label="Decisions" value={projects.flatMap(p=>p.cycles.flatMap(c=>c.decisions)).length} trend="up"/>
                  <Pill label="Pending" value={totalPending} trend="flat"/>
                  <Pill label="Running" value={running.size} trend={running.size>0?"up":"flat"}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:14}}>
                  {projects.map(p=>(
                    <ProjectCard key={p.id} project={p} isRunning={running.has(p.id)}
                      onClick={()=>set(()=>({activeId:p.id,view:"workspace"}))}
                      onDelete={deleteProject}/>
                  ))}
                  <div onClick={()=>setShowNew(true)}
                    style={{border:"1px dashed #ffffff15",borderRadius:8,padding:"16px",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:8,minHeight:160,transition:"border-color 0.2s"}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor="#C8A96E55"}
                    onMouseLeave={e=>e.currentTarget.style.borderColor="#ffffff15"}>
                    <span style={{fontSize:24,color:"#334455"}}>+</span>
                    <span style={{fontFamily:"monospace",fontSize:11,color:"#445566"}}>New Project</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* WORKSPACE */}
      {view==="workspace"&&activeProject&&(
        <ProjectWorkspace
          project={activeProject}
          isRunning={running.has(activeProject.id)}
          onRunCycle={runCycle}
          onAction={handleAction}
          onBack={()=>set(()=>({view:"portfolio"}))}
          onUpdateStage={(id,stage)=>updProject(id,p=>({...p,stage}))}
        />
      )}

      {view==="workspace"&&!activeProject&&(
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100vh"}}>
          <button onClick={()=>set(()=>({view:"portfolio"}))} style={{fontFamily:"monospace",fontSize:12,color:"#C8A96E",background:"none",border:"1px solid #C8A96E44",borderRadius:5,padding:"8px 16px",cursor:"pointer"}}>← Back to portfolio</button>
        </div>
      )}
    </div>
  );
}

const LS={display:"block",fontFamily:"monospace",fontSize:10,color:"#6677AA",marginBottom:6,letterSpacing:0.5,textTransform:"uppercase"};
const IS={width:"100%",background:"#ffffff08",border:"1px solid #ffffff15",borderRadius:6,padding:"10px 14px",color:"#E8E8F4",fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"inherit"};
const CSS=`
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=JetBrains+Mono:wght@400;700&family=DM+Sans:wght@400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  ::-webkit-scrollbar{width:4px;height:4px;}
  ::-webkit-scrollbar-track{background:transparent;}
  ::-webkit-scrollbar-thumb{background:#ffffff15;border-radius:2px;}
  @keyframes fadeIn{to{opacity:1;}}
  @keyframes slideUp{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}
  @keyframes ping{0%,100%{transform:scale(1);opacity:0.3;}50%{transform:scale(1.8);opacity:0;}}
  @keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}
  @keyframes blink{0%,100%{opacity:1;}50%{opacity:0;}}
  input:focus,textarea:focus{border-color:#C8A96E66!important;}
  button:hover{opacity:0.85;}
`;
