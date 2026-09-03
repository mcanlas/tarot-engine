import sbt.Keys.*
import sbt.*

object Scala3Plugin extends AutoPlugin {
  override def trigger: PluginTrigger =
    AllRequirements

  override val buildSettings: Seq[Setting[?]] = Seq(
    scalaVersion := "3.9.0"
  )

  override val projectSettings: Seq[Setting[?]] = Seq(
    scalacOptions ++= Seq("-indent", "-rewrite")
  )
}
